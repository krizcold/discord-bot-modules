/**
 * Scheduled Messages - Design Panel
 *
 * Configure optional design elements: title, type, footer, prefix, format, color, image.
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
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

import { updateGroup } from '../utils/storage';
import {
  getPendingGroup,
  setPendingGroup,
  getEditingGroup,
} from '../utils/pageState';
import { ScheduledGroup, MessageDesign, TextFormat } from '../types/scheduled';
import {
  DESIGN_PANEL_ID,
  BTN,
  MODAL,
  DROPDOWN,
} from './constants';

// Format labels for display
const FORMAT_LABELS: Record<TextFormat, string> = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  code: 'Code',
  codeblock: 'Code Block',
  spoiler: 'Spoiler',
  quote: 'Quote',
};

// Format emojis for dropdown
const FORMAT_EMOJIS: Record<TextFormat, string> = {
  bold: '🔷',
  italic: '🔶',
  underline: '➖',
  strikethrough: '❌',
  code: '💻',
  codeblock: '📄',
  spoiler: '👁️',
  quote: '💬',
};


/**
 * Format color as hex string for display
 */
function formatColor(color: number | undefined): string {
  if (color === undefined) return '_Default_';
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Build design panel container
 */
function buildDesignContainer(
  context: PanelContext,
  group: Partial<ScheduledGroup>,
  isNew: boolean
): ContainerBuilder {
  const container = createContainer(V2Colors.primary);
  const design = group.design || { messageType: 'message' };
  const isEmbed = design.messageType === 'embed';

  // Title
  const groupName = group.name || 'Group';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${groupName} - Design`)
  );

  container.addSeparatorComponents(createSeparator());

  // === ROW 1: Message Type dropdown ===
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**Message Type**')
  );

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId(`panel_${DESIGN_PANEL_ID}_dropdown_${DROPDOWN.MESSAGE_TYPE}`)
    .setPlaceholder('Select message type...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Message')
        .setValue('message')
        .setDescription('Send as a regular text message')
        .setDefault(design.messageType === 'message'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Embed')
        .setValue('embed')
        .setDescription('Send as an embed with color/image support')
        .setDefault(design.messageType === 'embed'),
    );

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect)
  );

  // === ROW 2: Message Title section ===
  const titleDisplay = design.title ? `\`${design.title.substring(0, 30)}${design.title.length > 30 ? '...' : ''}\`` : '_Empty_';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Title** · ${titleDisplay}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('sched_edit_title')
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // === ROW 3: Prefix section ===
  const prefixDisplay = design.prefix ? `\`${design.prefix.substring(0, 20)}${design.prefix.length > 20 ? '...' : ''}\`` : '_Empty_';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Prefix** · ${prefixDisplay}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('sched_edit_prefix')
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // === ROW 4: Message Footer section ===
  const footerDisplay = design.footer ? `\`${design.footer.substring(0, 30)}${design.footer.length > 30 ? '...' : ''}\`` : '_Empty_';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Footer** · ${footerDisplay}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('sched_edit_footer')
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // === ROW 5: Text Format multi-select ===
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**Text Format**')
  );

  const allFormats: TextFormat[] = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'codeblock', 'spoiler', 'quote'];
  const currentFormats = design.formats || [];

  const formatSelect = new StringSelectMenuBuilder()
    .setCustomId(`panel_${DESIGN_PANEL_ID}_dropdown_${DROPDOWN.TEXT_FORMAT}`)
    .setPlaceholder('Select formatting options...')
    .setMinValues(0)
    .setMaxValues(allFormats.length)
    .addOptions(
      allFormats.map(fmt =>
        new StringSelectMenuOptionBuilder()
          .setLabel(FORMAT_LABELS[fmt])
          .setValue(fmt)
          .setEmoji(FORMAT_EMOJIS[fmt])
          .setDefault(currentFormats.includes(fmt))
      )
    );

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(formatSelect)
  );

  // === EMBED-ONLY OPTIONS ===
  if (isEmbed) {
    container.addSeparatorComponents(createSeparator());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# **Embed-only options**')
    );

    // === ROW 6: Color section (Embed only) ===
    const colorDisplay = formatColor(design.color);
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Color** · ${colorDisplay}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('sched_edit_color')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    );

    // === ROW 7: Image section (Embed only) ===
    const imageDisplay = design.image ? `\`${design.image.substring(0, 25)}...\`` : '_None_';
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Image** · ${imageDisplay}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('sched_edit_image')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Back button
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${DESIGN_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
    )
  );

  return container;
}

/**
 * Build design panel response
 */
function buildDesignResponse(context: PanelContext): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;

  const { group, isNew } = getEditingGroup(guildId, userId);
  const container = buildDesignContainer(context, group, isNew);

  return createV2Response([container]);
}

const designPanel: PanelOptions = {
  id: DESIGN_PANEL_ID,
  name: 'Design Settings',
  description: 'Configure message design elements',
  category: 'Chat',
  panelScope: 'guild',
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    if (!context.guildId) {
      return createV2Response([
        createContainer(V2Colors.danger)
          .addTextDisplayComponents(createText('## Error'))
          .addTextDisplayComponents(createText('This panel can only be used in a server.'))
      ]);
    }

    return buildDesignResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    // Back to editor
    if (buttonId === BTN.BACK) {
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    return buildDesignResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildDesignResponse(context);
    }

    const currentDesign = group.design || { messageType: 'message' as const };

    // Helper to save design
    const saveDesign = (newDesign: MessageDesign) => {
      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, design: newDesign });
      } else if (group.id) {
        updateGroup(guildId, group.id, { design: newDesign });
      }
    };

    // Edit title
    if (modalId === MODAL.EDIT_TITLE) {
      const title = interaction.fields.getTextInputValue('title').trim();
      saveDesign({ ...currentDesign, title: title || undefined });
    }

    // Edit footer
    if (modalId === MODAL.EDIT_FOOTER) {
      const footer = interaction.fields.getTextInputValue('footer').trim();
      saveDesign({ ...currentDesign, footer: footer || undefined });
    }

    // Edit prefix
    if (modalId === MODAL.EDIT_PREFIX) {
      const prefix = interaction.fields.getTextInputValue('prefix').trim();
      saveDesign({ ...currentDesign, prefix: prefix || undefined });
    }

    // Edit color
    if (modalId === MODAL.EDIT_COLOR) {
      const colorStr = interaction.fields.getTextInputValue('color').trim();
      let color: number | undefined;

      if (colorStr) {
        // Parse hex color (with or without #)
        const hex = colorStr.replace(/^#/, '');
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) {
          color = parsed;
        }
      }

      saveDesign({ ...currentDesign, color });
    }

    // Edit image
    if (modalId === MODAL.EDIT_IMAGE) {
      const image = interaction.fields.getTextInputValue('image').trim();
      saveDesign({ ...currentDesign, image: image || undefined });
    }

    return buildDesignResponse(context);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);
    const currentDesign = group.design || { messageType: 'message' as const };

    // Helper to save design
    const saveDesign = (newDesign: MessageDesign) => {
      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, design: newDesign });
      } else if (group.id) {
        updateGroup(guildId, group.id, { design: newDesign });
      }
    };

    // Handle message type select
    if (dropdownId === DROPDOWN.MESSAGE_TYPE && values[0]) {
      const messageType = values[0] as 'message' | 'embed';
      saveDesign({ ...currentDesign, messageType });
    }

    // Handle text format multi-select
    if (dropdownId === DROPDOWN.TEXT_FORMAT) {
      const formats = values as TextFormat[];
      saveDesign({ ...currentDesign, formats: formats.length > 0 ? formats : undefined });
    }

    return buildDesignResponse(context);
  },
};

export default designPanel;
