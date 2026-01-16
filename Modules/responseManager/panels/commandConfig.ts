/**
 * Response Manager - Command Config Panel
 *
 * Configure command trigger settings.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
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
  filterMappableCommands,
  getOptionTypeDisplay,
  CommandInfo,
} from '../utils/commandUtils';
import { ResponseGroup } from '../types/responseManager';
import {
  COMMAND_CONFIG_PANEL_ID,
  EDITOR_PANEL_ID,
  BTN,
  DROPDOWN,
} from './constants';

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
 * Build command config container
 */
async function buildCommandConfigContainer(
  context: PanelContext,
  group: ResponseGroup,
  commands: CommandInfo[]
): Promise<ContainerBuilder> {
  const container = createContainer(V2Colors.warning);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Configure Command Trigger')
  );

  // Help text
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '-# Select a command to trigger when keywords match. ' +
      'Pattern variables like `{hour}` can be mapped to command arguments.'
    )
  );

  container.addSeparatorComponents(createSeparator());

  // Current command
  if (group.commandName) {
    const cmdInfo = commands.find(c => c.name === group.commandName);
    if (cmdInfo) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Selected Command:** \`/${cmdInfo.name}\`\n${cmdInfo.description}`)
      );

      // Show command options
      if (cmdInfo.options.length > 0) {
        const optionsList = cmdInfo.options
          .map(o => `• **${o.name}**${o.required ? '*' : ''} (${getOptionTypeDisplay(o.type)})`)
          .join('\n');
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Arguments:**\n${optionsList}\n-# *\\* = required*`)
        );
      } else {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('**Arguments:** *No arguments*')
        );
      }

      // Show current mappings if any
      if (group.argumentMapping && Object.keys(group.argumentMapping).length > 0) {
        const mappingsList = Object.entries(group.argumentMapping)
          .map(([arg, mapping]) => {
            const value = mapping.source === 'variable' ? `\`{${mapping.value}}\`` : `"${mapping.value}"`;
            return `• ${arg} → ${value}`;
          })
          .join('\n');
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Current Mappings:**\n${mappingsList}`)
        );
      }

      // Show pattern variables available
      const allVars = new Set<string>();
      group.keywords?.forEach(k => k.variables.forEach(v => allVars.add(v)));

      if (allVars.size > 0) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Available Variables:** ${[...allVars].map(v => `\`{${v}}\``).join(', ')}`)
        );
      }
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Selected Command:** \`/${group.commandName}\` *(not found)*`)
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**No command selected**\n*Select a command from the dropdown below.*')
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Command dropdown
  const mappableCommands = filterMappableCommands(commands);
  const commandOptions = mappableCommands.slice(0, 25).map(cmd =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`/${cmd.name}`)
      .setValue(cmd.name)
      .setDescription(cmd.description.substring(0, 100) || 'No description')
      .setDefault(cmd.name === group.commandName)
  );

  if (commandOptions.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`panel_${COMMAND_CONFIG_PANEL_ID}_dropdown_${DROPDOWN.COMMAND}`)
          .setPlaceholder(group.commandName ? `/${group.commandName}` : 'Select a command...')
          .addOptions(commandOptions)
      )
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('*No compatible commands found*')
    );
  }

  // Action buttons
  const actionButtons: ButtonBuilder[] = [];

  // Map arguments button (only if command selected and has options)
  if (group.commandName) {
    const cmdInfo = commands.find(c => c.name === group.commandName);
    if (cmdInfo && cmdInfo.options.length > 0) {
      actionButtons.push(
        createButton(`panel_${COMMAND_CONFIG_PANEL_ID}_btn_${BTN.MAP_ARGS}`, 'Map Arguments', ButtonStyle.Primary)
      );
    }
  }

  actionButtons.push(
    createButton(`panel_${COMMAND_CONFIG_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
  );

  container.addActionRowComponents(createButtonRow(...actionButtons));

  return container;
}

/**
 * Build command config response
 */
async function buildCommandConfigResponse(context: PanelContext): Promise<PanelResponse> {
  const group = getEditingGroup(context);

  if (!group) {
    return createV2Response([
      createContainer(V2Colors.danger)
        .addTextDisplayComponents(createText('## Error'))
        .addTextDisplayComponents(createText('No group selected for editing.'))
    ]);
  }

  // Fetch available commands
  const commands = await getAvailableCommands(context.client, context.guildId || undefined);
  const container = await buildCommandConfigContainer(context, group, commands);

  return createV2Response([container]);
}

const commandConfigPanel: PanelOptions = {
  id: COMMAND_CONFIG_PANEL_ID,
  name: 'Command Configuration',
  description: 'Configure command trigger settings',
  category: 'Settings',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    return buildCommandConfigResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    // Map arguments
    if (buttonId === BTN.MAP_ARGS) {
      const argMappingPanel = await import('./argumentMapping');
      return argMappingPanel.default.callback(context);
    }

    // Back - return to editor
    if (buttonId === BTN.BACK) {
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    return buildCommandConfigResponse(context);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const group = getEditingGroup(context);

    if (!group) {
      return buildCommandConfigResponse(context);
    }

    if (dropdownId === DROPDOWN.COMMAND) {
      const commandName = values[0];

      if (isPendingGroup(context)) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: {
            ...state.pendingGroup,
            commandName,
            argumentMapping: {}, // Clear mappings when command changes
          }
        });
      } else {
        updateGroup(guildId, group.id, {
          commandName,
          argumentMapping: {},
        });
      }
    }

    return buildCommandConfigResponse(context);
  },
};

export default commandConfigPanel;
