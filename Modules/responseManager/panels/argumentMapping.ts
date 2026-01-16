/**
 * Response Manager - Argument Mapping Panel
 *
 * Map pattern variables to command arguments.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  GatewayIntentBits,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import {
  createV2Response,
  createContainer,
  createText,
  createSeparator,
  createButton,
  createButtonRow,
  V2Colors,
} from '@internal/utils/panel/v2';

import { getGroup, updateGroup } from '../utils/storage';
import {
  getPanelState,
  updatePanelState,
  getEditingGroupId,
} from '../utils/pageState';
import {
  getAvailableCommands,
  getOptionTypeDisplay,
  CommandInfo,
  CommandOptionInfo,
} from '../utils/commandUtils';
import { ResponseGroup, ArgumentMapping } from '../types/responseManager';
import {
  ARG_MAPPING_PANEL_ID,
  COMMAND_CONFIG_PANEL_ID,
  BTN,
  DROPDOWN,
  MODAL,
} from './constants';

// Arguments per page for pagination
const ARGS_PER_PAGE = 3;

/**
 * Get the group being edited
 */
function getEditingGroup(context: PanelContext): ResponseGroup | null {
  const guildId = context.guildId!;
  const userId = context.userId;

  const editingId = getEditingGroupId(guildId, userId);
  if (!editingId) {
    const state = getPanelState(guildId, userId);
    if (state.pendingGroup) {
      return state.pendingGroup as ResponseGroup;
    }
    return null;
  }

  return getGroup(guildId, editingId) || null;
}

/**
 * Check if editing a pending (unsaved) group
 */
function isPendingGroup(context: PanelContext): boolean {
  const guildId = context.guildId!;
  const userId = context.userId;
  return !getEditingGroupId(guildId, userId);
}

/**
 * Get all pattern variables from group
 */
function getPatternVariables(group: ResponseGroup): string[] {
  const vars = new Set<string>();
  group.keywords?.forEach(k => k.variables.forEach(v => vars.add(v)));
  return [...vars].sort();
}

/**
 * Get current mapping display for an option
 */
function getMappingDisplay(
  option: CommandOptionInfo,
  mapping: ArgumentMapping | undefined
): string {
  if (!mapping) {
    return option.required ? '**Not set** (required!)' : '*Not set*';
  }

  if (mapping.source === 'variable') {
    return `\`{${mapping.value}}\``;
  } else {
    return `"${mapping.value}"`;
  }
}

/**
 * Build argument mapping container
 */
function buildArgMappingContainer(
  context: PanelContext,
  group: ResponseGroup,
  cmdInfo: CommandInfo,
  argPage: number
): ContainerBuilder {
  const container = createContainer(V2Colors.warning);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Argument Mapping: /${cmdInfo.name}`)
  );

  // Available variables
  const variables = getPatternVariables(group);
  if (variables.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Pattern Variables:** ${variables.map(v => `\`{${v}}\``).join(', ')}`)
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Pattern Variables:** *None defined* (add variables like `{hour}` to your keywords)')
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Calculate pagination
  const options = cmdInfo.options;
  const totalPages = Math.ceil(options.length / ARGS_PER_PAGE);
  const currentPage = Math.min(argPage, totalPages);
  const startIdx = (currentPage - 1) * ARGS_PER_PAGE;
  const pageOptions = options.slice(startIdx, startIdx + ARGS_PER_PAGE);

  // Show current mappings summary
  const mappingSummary = options.map(opt => {
    const mapping = group.argumentMapping?.[opt.name];
    const status = mapping ? '✓' : (opt.required ? '✗' : '○');
    return `${status} **${opt.name}**${opt.required ? '*' : ''}`;
  }).join('  ');

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Mappings:** ${mappingSummary}`)
  );

  container.addSeparatorComponents(createSeparator());

  // Dropdowns for each argument on this page
  for (const opt of pageOptions) {
    const mapping = group.argumentMapping?.[opt.name];
    const displayValue = getMappingDisplay(opt, mapping);

    // Build dropdown options
    const dropdownOptions: StringSelectMenuOptionBuilder[] = [];

    // Variable options
    for (const varName of variables) {
      dropdownOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`{${varName}}`)
          .setValue(`var:${varName}`)
          .setDescription(`Use pattern variable {${varName}}`)
          .setDefault(mapping?.source === 'variable' && mapping.value === varName)
      );
    }

    // Static value option
    dropdownOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel('Static value...')
        .setValue('static:__prompt__')
        .setDescription('Enter a fixed value')
        .setDefault(mapping?.source === 'static')
    );

    // Clear option (only for optional args)
    if (!opt.required) {
      dropdownOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('Not set')
          .setValue('clear')
          .setDescription('Do not pass this argument')
          .setDefault(!mapping)
      );
    }

    // Show argument info and dropdown
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${opt.name}**${opt.required ? '*' : ''} (${getOptionTypeDisplay(opt.type)}): ${displayValue}`
      )
    );

    if (dropdownOptions.length > 0) {
      container.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`panel_${ARG_MAPPING_PANEL_ID}_dropdown_${DROPDOWN.ARG_MAP}_${opt.name}`)
            .setPlaceholder(`Map ${opt.name}...`)
            .addOptions(dropdownOptions)
        )
      );
    }
  }

  // Pagination and action buttons
  const actionButtons: ButtonBuilder[] = [];

  if (totalPages > 1) {
    actionButtons.push(
      createButton(`panel_${ARG_MAPPING_PANEL_ID}_btn_${BTN.ARG_PREV}`, 'Prev', ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      createButton(`panel_${ARG_MAPPING_PANEL_ID}_btn_page`, `${currentPage}/${totalPages}`, ButtonStyle.Secondary)
        .setDisabled(true),
      createButton(`panel_${ARG_MAPPING_PANEL_ID}_btn_${BTN.ARG_NEXT}`, 'Next', ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages)
    );
  }

  actionButtons.push(
    createButton(`panel_${ARG_MAPPING_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
  );

  container.addSeparatorComponents(createSeparator());
  container.addActionRowComponents(createButtonRow(...actionButtons));

  // Footer note
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('-# *\\* = required argument*')
  );

  return container;
}

/**
 * Build argument mapping response
 */
async function buildArgMappingResponse(context: PanelContext, argPage: number = 1): Promise<PanelResponse> {
  const group = getEditingGroup(context);

  if (!group || !group.commandName) {
    return createV2Response([
      createContainer(V2Colors.danger)
        .addTextDisplayComponents(createText('## Error'))
        .addTextDisplayComponents(createText('No command selected.'))
    ]);
  }

  // Get command info
  const commands = await getAvailableCommands(context.client, context.guildId || undefined);
  const cmdInfo = commands.find(c => c.name === group.commandName);

  if (!cmdInfo) {
    return createV2Response([
      createContainer(V2Colors.danger)
        .addTextDisplayComponents(createText('## Error'))
        .addTextDisplayComponents(createText(`Command "/${group.commandName}" not found.`))
    ]);
  }

  if (cmdInfo.options.length === 0) {
    return createV2Response([
      createContainer(V2Colors.info)
        .addTextDisplayComponents(createText('## No Arguments'))
        .addTextDisplayComponents(createText(`The command \`/${cmdInfo.name}\` has no arguments to map.`))
        .addSeparatorComponents(createSeparator())
        .addActionRowComponents(createButtonRow(
          createButton(`panel_${ARG_MAPPING_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
        ))
    ]);
  }

  const container = buildArgMappingContainer(context, group, cmdInfo, argPage);
  return createV2Response([container]);
}

// Store current arg page per user
const argPageState = new Map<string, number>();

function getArgPage(guildId: string, userId: string): number {
  return argPageState.get(`${guildId}:${userId}`) || 1;
}

function setArgPage(guildId: string, userId: string, page: number): void {
  argPageState.set(`${guildId}:${userId}`, page);
}

const argumentMappingPanel: PanelOptions = {
  id: ARG_MAPPING_PANEL_ID,
  name: 'Argument Mapping',
  description: 'Map pattern variables to command arguments',
  category: 'Settings',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    const argPage = getArgPage(context.guildId!, context.userId);
    return buildArgMappingResponse(context, argPage);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const guildId = context.guildId!;
    const userId = context.userId;

    // Pagination
    if (buttonId === BTN.ARG_PREV) {
      const current = getArgPage(guildId, userId);
      setArgPage(guildId, userId, Math.max(1, current - 1));
      return buildArgMappingResponse(context, getArgPage(guildId, userId));
    }

    if (buttonId === BTN.ARG_NEXT) {
      const current = getArgPage(guildId, userId);
      setArgPage(guildId, userId, current + 1);
      return buildArgMappingResponse(context, getArgPage(guildId, userId));
    }

    // Back - return to command config
    if (buttonId === BTN.BACK) {
      setArgPage(guildId, userId, 1); // Reset page
      const commandConfigPanel = await import('./commandConfig');
      return commandConfigPanel.default.callback(context);
    }

    return buildArgMappingResponse(context, getArgPage(guildId, userId));
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const group = getEditingGroup(context);

    if (!group || !dropdownId?.startsWith(DROPDOWN.ARG_MAP)) {
      return buildArgMappingResponse(context, getArgPage(guildId, userId));
    }

    // Extract argument name from dropdown ID
    const argName = dropdownId.replace(`${DROPDOWN.ARG_MAP}_`, '');
    const value = values[0];

    // Handle static value prompt - show modal but return current state
    // (modal submission will update the panel)
    if (value === 'static:__prompt__') {
      const modal = new ModalBuilder()
        .setCustomId(`panel_${ARG_MAPPING_PANEL_ID}_modal_${MODAL.STATIC_VALUE}_${argName}`)
        .setTitle(`Set Static Value for ${argName}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('value')
              .setLabel('Value')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(500)
          )
        );

      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
        // Return current state - modal submission will update
        return buildArgMappingResponse(context, getArgPage(guildId, userId));
      }
    }

    // Update mapping
    const currentMappings = { ...(group.argumentMapping || {}) };

    if (value === 'clear') {
      delete currentMappings[argName];
    } else if (value.startsWith('var:')) {
      currentMappings[argName] = {
        source: 'variable',
        value: value.replace('var:', ''),
      };
    }

    if (isPendingGroup(context)) {
      const state = getPanelState(guildId, userId);
      updatePanelState(guildId, userId, {
        pendingGroup: { ...state.pendingGroup, argumentMapping: currentMappings }
      });
    } else {
      updateGroup(guildId, group.id, { argumentMapping: currentMappings });
    }

    return buildArgMappingResponse(context, getArgPage(guildId, userId));
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const group = getEditingGroup(context);

    if (!group) {
      return buildArgMappingResponse(context, getArgPage(guildId, userId));
    }

    const interaction = context.interaction;
    if (!interaction || !('fields' in interaction)) {
      return buildArgMappingResponse(context, getArgPage(guildId, userId));
    }

    // Extract argument name from modal ID
    if (modalId.startsWith(`${MODAL.STATIC_VALUE}_`)) {
      const argName = modalId.replace(`${MODAL.STATIC_VALUE}_`, '');
      const value = interaction.fields.getTextInputValue('value').trim();

      const currentMappings = { ...(group.argumentMapping || {}) };
      currentMappings[argName] = {
        source: 'static',
        value,
      };

      if (isPendingGroup(context)) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, argumentMapping: currentMappings }
        });
      } else {
        updateGroup(guildId, group.id, { argumentMapping: currentMappings });
      }
    }

    return buildArgMappingResponse(context, getArgPage(guildId, userId));
  },
};

export default argumentMappingPanel;
