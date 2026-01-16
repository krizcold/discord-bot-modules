/**
 * Response Manager - Keywords Config Panel
 *
 * Sub-panel for managing keywords with Edit/Upload/Download like config panels.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  LabelBuilder,
  AttachmentBuilder,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import {
  createV2Response,
  createContainer,
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
import { parsePatterns } from '../utils/patternParser';
import { ResponseGroup } from '../types/responseManager';
import {
  KEYWORDS_PANEL_ID,
  BTN,
  MODAL,
} from './constants';

/**
 * Get the group being edited
 */
function getEditingGroup(context: PanelContext): { group: ResponseGroup | Partial<ResponseGroup>; isNew: boolean } {
  const guildId = context.guildId!;
  const userId = context.userId;
  const state = getPanelState(guildId, userId);
  const editingId = getEditingGroupId(guildId, userId);

  if (editingId) {
    const group = getGroup(guildId, editingId);
    if (group) {
      return { group, isNew: false };
    }
  }

  return {
    group: state.pendingGroup || {
      name: '',
      enabled: true,
      keywords: [],
      matchMode: 'word',
      responseType: 'react',
      responses: [],
      selectionMode: 'random',
      enabledChannels: [],
      groupCooldown: { charges: 0, reloadSeconds: 1 },
      keywordCooldown: { charges: 0, reloadSeconds: 0 },
    },
    isNew: true,
  };
}

/**
 * Format keywords for display (show preview)
 */
function formatKeywordsPreview(keywords: { pattern: string }[]): string {
  if (keywords.length === 0) {
    return '*No keywords configured*';
  }

  const lines = keywords.map(k => k.pattern);
  const preview = lines.slice(0, 15).join('\n');

  if (lines.length > 15) {
    return '```\n' + preview + '\n```\n-# ... and ' + (lines.length - 15) + ' more';
  }

  return '```\n' + preview + '\n```';
}

/**
 * Build keywords config container
 */
function buildKeywordsContainer(
  context: PanelContext,
  group: ResponseGroup | Partial<ResponseGroup>
): ContainerBuilder {
  const container = createContainer(V2Colors.info);
  const keywords = group.keywords || [];

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 📝 Keywords`)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${keywords.length} keyword${keywords.length !== 1 ? 's' : ''} configured`)
  );

  container.addSeparatorComponents(createSeparator());

  // Keywords preview
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formatKeywordsPreview(keywords))
  );

  container.addSeparatorComponents(createSeparator());

  // Edit button
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${KEYWORDS_PANEL_ID}_btn_${BTN.EDIT_KEYWORDS}`, '✏️ Edit', ButtonStyle.Primary)
    )
  );

  // Upload/Download buttons
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${KEYWORDS_PANEL_ID}_btn_${BTN.UPLOAD_KEYWORDS}`, '📤 Upload', ButtonStyle.Secondary),
      createButton(`panel_${KEYWORDS_PANEL_ID}_btn_${BTN.DOWNLOAD_KEYWORDS}`, '📥 Download', ButtonStyle.Secondary)
        .setDisabled(keywords.length === 0)
    )
  );

  // Back button
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${KEYWORDS_PANEL_ID}_btn_${BTN.BACK}`, '◀ Back', ButtonStyle.Secondary)
    )
  );

  return container;
}

/**
 * Build keywords config response
 */
function buildKeywordsResponse(context: PanelContext): PanelResponse {
  const { group } = getEditingGroup(context);
  const container = buildKeywordsContainer(context, group);
  return createV2Response([container]);
}

const keywordsConfigPanel: PanelOptions = {
  id: KEYWORDS_PANEL_ID,
  name: 'Keywords Configuration',
  description: 'Configure trigger keywords',
  category: 'Settings',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    return buildKeywordsResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(context);
    const state = getPanelState(guildId, userId);

    // Edit keywords - show modal with full list
    if (buttonId === BTN.EDIT_KEYWORDS) {
      const currentKeywords = (group.keywords || []).map(k => k.pattern).join('\n');

      const modal = new ModalBuilder()
        .setCustomId(`panel_${KEYWORDS_PANEL_ID}_modal_${MODAL.KEYWORDS}`)
        .setTitle('Edit Keywords')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('keywords')
              .setLabel('Keywords (one per line)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(4000)
              .setValue(currentKeywords)
              .setPlaceholder('hello\nhi there\nts {hour}:{min}')
          )
        );

      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
      }
      return null;
    }

    // Upload keywords - show modal with file upload
    if (buttonId === BTN.UPLOAD_KEYWORDS) {
      const modal = new ModalBuilder()
        .setCustomId(`panel_${KEYWORDS_PANEL_ID}_modal_${MODAL.UPLOAD_KEYWORDS}`)
        .setTitle('Upload Keywords');

      const fileUpload = new FileUploadBuilder()
        .setCustomId('keywords_file')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

      const fileLabel = new LabelBuilder()
        .setLabel('Keywords File')
        .setDescription('Upload a .txt file with one keyword per line')
        .setFileUploadComponent(fileUpload);

      modal.addLabelComponents(fileLabel);

      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
      }
      return null;
    }

    // Download keywords
    if (buttonId === BTN.DOWNLOAD_KEYWORDS) {
      const keywords = group.keywords || [];
      if (keywords.length === 0) {
        return buildKeywordsResponse(context);
      }

      const content = keywords.map(k => k.pattern).join('\n');
      const buffer = Buffer.from(content, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'keywords.txt' });

      const interaction = context.interaction as any;
      if (interaction && 'reply' in interaction) {
        await interaction.reply({
          content: '📥 Here are your keywords:',
          files: [attachment],
          flags: MessageFlags.Ephemeral,
        });
      }

      return null;
    }

    // Back - return to editor
    if (buttonId === BTN.BACK) {
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    return buildKeywordsResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(context);
    const state = getPanelState(guildId, userId);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildKeywordsResponse(context);
    }

    // Edit keywords (replace entire list)
    if (modalId === MODAL.KEYWORDS) {
      const keywordsText = interaction.fields.getTextInputValue('keywords');
      const keywords = parsePatterns(keywordsText);

      if (isNew) {
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, keywords }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { keywords });
      }
    }

    // Upload keywords file
    if (modalId === MODAL.UPLOAD_KEYWORDS) {
      const modalFields = interaction.fields as any;
      const uploadedFiles = modalFields.getUploadedFiles?.('keywords_file');

      if (uploadedFiles && uploadedFiles.size > 0) {
        const attachment = uploadedFiles.first();
        if (attachment?.url) {
          try {
            const response = await fetch(attachment.url);
            if (response.ok) {
              const text = await response.text();
              const keywords = parsePatterns(text);

              if (isNew) {
                updatePanelState(guildId, userId, {
                  pendingGroup: { ...state.pendingGroup, keywords }
                });
              } else {
                updateGroup(guildId, (group as ResponseGroup).id, { keywords });
              }
            }
          } catch (error) {
            console.error('[KeywordsConfig] Failed to process uploaded file:', error);
          }
        }
      }
    }

    return buildKeywordsResponse(context);
  },
};

export default keywordsConfigPanel;
