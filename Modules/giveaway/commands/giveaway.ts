import {
  Client,
  CommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  GatewayIntentBits,
  PermissionsBitField,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  LabelBuilder,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { getPanelManager } from '@internal/utils/panelManager';
import { storeNavigationContext } from '@internal/utils/panel/panelButtonHandler';
import { registerButtonHandler } from '@internal/events/interactionCreate/buttonHandler';
import { registerModalHandler } from '@internal/events/interactionCreate/modalSubmitHandler';
import * as giveawayManager from '../manager/giveawayManager';
import { registerGiveawayHandlers } from '../handlers/registry';
import { GW_PAGE_BTN, GW_PAGE_MODAL } from '../constants';
import { setPageState } from '../panels/main/pageState';
import { buildMainPanelResponse } from '../panels/main/mainPanel';

// Panel ID for giveaway main panel
const GIVEAWAY_PANEL_ID = 'giveaway';

const giveawayCommand: CommandOptions = {
  name: 'giveaway',
  description: 'Manage giveaways for this server.',
  testOnly: true,
  dm_permission: false,
  requiredIntents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  permissionsRequired: [PermissionsBitField.Flags.ManageMessages],

  initialize: (client: Client) => {
    // Register page selector button handler (shows modal)
    registerButtonHandler(client, GW_PAGE_BTN, async (client: Client, interaction: ButtonInteraction) => {
      // Parse current page and total pages from customId: gw_page_{currentPage}_{totalPages}
      const parts = interaction.customId.split('_');
      const currentPage = parseInt(parts[2], 10) || 0;
      const totalPages = parseInt(parts[3], 10) || 1;

      // Build page options for select menu
      const pageOptions: StringSelectMenuOptionBuilder[] = [];
      for (let i = 0; i < totalPages; i++) {
        pageOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`Page ${i + 1}`)
            .setValue(String(i))
            .setDefault(i === currentPage)
        );
      }

      // Create select menu for page selection (desktop)
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('page_select')
        .setPlaceholder(`Current: Page ${currentPage + 1}`)
        .addOptions(pageOptions);

      // Wrap select menu in a label
      const selectLabel = new LabelBuilder()
        .setLabel('Select a page')
        .setDescription('Choose from the dropdown (desktop only)')
        .setStringSelectMenuComponent(selectMenu);

      // Create text input for manual page entry (mobile fallback)
      const textInput = new TextInputBuilder()
        .setCustomId('page_input')
        .setLabel(`Or enter page number (1-${totalPages})`)
        .setPlaceholder(`Type a number between 1 and ${totalPages}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMinLength(1)
        .setMaxLength(3);

      // Build modal with both components
      const modal = new ModalBuilder()
        .setCustomId(`${GW_PAGE_MODAL}_${totalPages}`)
        .setTitle('Go to Page')
        .addLabelComponents(selectLabel)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
        );

      await interaction.showModal(modal);
    }, { timeoutMs: null });

    // Register page selector modal handler
    registerModalHandler(client, GW_PAGE_MODAL, async (client: Client, interaction: ModalSubmitInteraction) => {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      if (!guildId) {
        await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
      }

      // Parse total pages from modal customId: gw_page_modal_{totalPages}
      const parts = interaction.customId.split('_');
      const totalPages = parseInt(parts[3], 10) || 1;

      let targetPage: number | null = null;

      // First check text input (prioritized if defined)
      try {
        const textValue = interaction.fields.getTextInputValue('page_input');
        if (textValue && textValue.trim()) {
          const parsed = parseInt(textValue.trim(), 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
            targetPage = parsed - 1; // Convert to 0-indexed
          }
        }
      } catch {
        // Text input might be empty
      }

      // Fall back to select menu if text input was empty
      if (targetPage === null) {
        try {
          const selectValues = interaction.fields.getStringSelectValues('page_select');
          if (selectValues && selectValues.length > 0) {
            targetPage = parseInt(selectValues[0], 10);
          }
        } catch {
          // Select menu might not be present on mobile
        }
      }

      // Validate and set page
      if (targetPage === null || targetPage < 0 || targetPage >= totalPages) {
        await interaction.reply({
          content: `Invalid page number. Please enter a number between 1 and ${totalPages}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Update page state and refresh panel
      setPageState(userId, guildId, targetPage);

      // Build panel context and response
      const panelManager = getPanelManager(client);
      const context = panelManager.createDirectCommandContext(GIVEAWAY_PANEL_ID, interaction, client);
      const response = await buildMainPanelResponse(context, targetPage);

      await interaction.deferUpdate();
      await interaction.editReply(response);
    });

    // Register all button and modal handlers via centralized registry
    registerGiveawayHandlers(client);

    // Schedule any existing active giveaways
    giveawayManager.scheduleExistingGiveaways(client);
  },

  callback: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Create panel context for direct command access
    // Use panelManager's helper method which accepts any interaction type
    const panelManager = getPanelManager(client);
    const context = panelManager.createDirectCommandContext(
      GIVEAWAY_PANEL_ID,
      interaction,
      client
    );

    // Execute the panel
    const response = await panelManager.handlePanelInteraction(context);

    await interaction.reply(response);

    // Store navigation context for the initial reply (which may be the persistent warning)
    // Note: Dynamic update registration happens in main.ts onPersistentCreated callback
    // when the actual panel is created after the warning is confirmed
    if (interaction.replied) {
      const reply = await interaction.fetchReply();
      storeNavigationContext(reply.id, context.navigationStack || [], context.accessMethod);
    }
  },
};

export = giveawayCommand;
