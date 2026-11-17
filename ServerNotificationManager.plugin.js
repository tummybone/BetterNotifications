/**
 * @name GlobalNotificationSettings
 * @author tummybone
 * @description Quickly change notification and mention settings for all or individual Discord servers.
 * @version 1.5.0
 * @source https://github.com/BetterDiscord/BetterDiscord
 */

module.exports = class ServerSignals {
  constructor() {
    this.levels = [
      { value: 0, label: "All messages", detail: "Notify for every new message." },
      { value: 1, label: "Only @mentions", detail: "Notify only for mentions and replies." },
      { value: 2, label: "Nothing", detail: "Disable message notifications." }
    ];
    this.selectedLevel = 1;
    this.suppressEveryone = true;
    this.suppressRoles = true;
    this.suppressHighlights = true;
    this.muteScheduledEvents = true;
    this.mobilePush = true;
    this.running = false;
  }

  start() {
    BdApi.UI.showToast("Server Signals enabled", { type: "success" });
  }

  stop() {}

  getGuildStore() {
    return BdApi.Webpack.getStore("GuildStore")
      || BdApi.Webpack.getByKeys("getGuilds", "getGuild");
  }

  getRestApi() {
    return BdApi.Webpack.getByKeys("get", "post", "put", "patch", "del");
  }

  getNotificationActions() {
    return BdApi.Webpack.getModule(
      (module) => typeof module?.updateGuildNotificationSettings === "function"
    );
  }

  getNotificationStore() {
    return BdApi.Webpack.getStore("UserGuildSettingsStore");
  }

  getGuildUpdater() {
    const notificationActions = this.getNotificationActions();
    if (notificationActions) {
      return (guildId, settings) => notificationActions.updateGuildNotificationSettings(guildId, settings);
    }

    const rest = this.getRestApi();
    if (rest?.patch) {
      return (guildId, settings) => rest.patch({
        url: `/users/@me/guilds/${guildId}/settings`,
        body: settings
      });
    }

    throw new Error("Discord's notification module could not be found.");
  }

  buildNotificationSettings({
    level,
    suppressEveryone,
    suppressRoles,
    suppressHighlights,
    muteScheduledEvents,
    mobilePush
  }) {
    return {
      message_notifications: level,
      suppress_everyone: suppressEveryone,
      suppress_roles: suppressRoles,
      notify_highlights: suppressHighlights ? 2 : 0,
      mute_scheduled_events: muteScheduledEvents,
      mobile_push: mobilePush
    };
  }

  async updateGuild(guildId, settings) {
    const updateGuildNotificationSettings = this.getGuildUpdater();
    return updateGuildNotificationSettings(guildId, settings);
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async applyToAll(
    level,
    suppressEveryone,
    suppressRoles,
    suppressHighlights,
    muteScheduledEvents,
    mobilePush,
    status,
    button
  ) {
    if (this.running) return;

    const guildStore = this.getGuildStore();
    const guilds = guildStore?.getGuilds?.();

    if (!guilds) {
      status.textContent = "Discord's notification module could not be found.";
      BdApi.UI.showToast("Discord's notification module could not be found. Reload Discord and try again.", {
        type: "error",
        timeout: 6000
      });
      return;
    }

    const ids = Object.keys(guilds);
    if (!ids.length) {
      BdApi.UI.showToast("No servers found.", { type: "warning" });
      return;
    }

    const updateGuild = this.getGuildUpdater();
    this.running = true;
    button.disabled = true;

    let updated = 0;
    let failed = 0;

    try {
      for (const [index, guildId] of ids.entries()) {
        status.textContent = `Updating ${index + 1} of ${ids.length}…`;

        try {
          await updateGuild(guildId, this.buildNotificationSettings({
            level,
            suppressEveryone,
            suppressRoles,
            suppressHighlights,
            muteScheduledEvents,
            mobilePush
          }));
          updated++;
        } catch (error) {
          console.error(`[Server Signals] Could not update guild ${guildId}`, error);
          failed++;
        }

        if (index < ids.length - 1) {
          await this.wait(450);
        }
      }
    } finally {
      this.running = false;
      button.disabled = false;
    }

    status.textContent = failed
      ? `Updated ${updated} servers; ${failed} failed. You can safely retry.`
      : `Done — updated all ${updated} servers.`;

    BdApi.UI.showToast(
      failed ? `Updated ${updated} servers (${failed} failed)` : `Updated ${updated} servers`,
      { type: failed ? "warning" : "success", timeout: 5000 }
    );
  }

  createServerRow(guild) {
    const notificationStore = this.getNotificationStore();
    const current = notificationStore?.getGuildSettings?.(guild.id) || {};
    const details = document.createElement("details");
    details.dataset.guildName = guild.name.toLowerCase();
    details.style.cssText = "border:1px solid var(--border-subtle);border-radius:10px;background:var(--background-secondary);overflow:hidden";

    const summary = document.createElement("summary");
    summary.style.cssText = "display:flex;align-items:center;gap:11px;padding:12px;cursor:pointer;list-style:none;font-weight:600";

    const icon = document.createElement("span");
    icon.style.cssText = "display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:10px;background:var(--brand-500);color:white;font-size:11px;font-weight:700";
    icon.textContent = guild.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    const name = document.createElement("span");
    name.textContent = guild.name;
    name.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

    const hint = document.createElement("span");
    hint.textContent = "Edit";
    hint.style.cssText = "color:var(--text-muted);font-size:12px;font-weight:500";
    summary.append(icon, name, hint);

    const controls = document.createElement("div");
    controls.style.cssText = "display:grid;gap:12px;padding:2px 12px 14px 57px";

    const levelLabel = document.createElement("label");
    levelLabel.style.cssText = "display:grid;gap:6px;color:var(--text-muted);font-size:12px;font-weight:600";
    levelLabel.textContent = "Notification level";

    const select = document.createElement("select");
    select.style.cssText = "width:100%;padding:9px 10px;border:1px solid var(--border-subtle);border-radius:7px;background:var(--background-primary);color:var(--text-normal)";
    this.levels.forEach((level) => {
      const option = document.createElement("option");
      option.value = String(level.value);
      option.textContent = level.label;
      option.selected = level.value === (current.message_notifications ?? 1);
      select.append(option);
    });
    levelLabel.append(select);

    const suppressLabel = document.createElement("label");
    suppressLabel.style.cssText = "display:flex;align-items:center;gap:9px;color:var(--text-normal);font-size:13px;cursor:pointer";
    const suppress = document.createElement("input");
    suppress.type = "checkbox";
    suppress.checked = current.suppress_everyone ?? false;
    suppressLabel.append(suppress, document.createTextNode("Suppress @everyone and @here"));

    const suppressRolesLabel = document.createElement("label");
    suppressRolesLabel.style.cssText = "display:flex;align-items:center;gap:9px;color:var(--text-normal);font-size:13px;cursor:pointer";
    const suppressRoles = document.createElement("input");
    suppressRoles.type = "checkbox";
    suppressRoles.checked = current.suppress_roles ?? false;
    suppressRolesLabel.append(suppressRoles, document.createTextNode("Suppress all role @mentions"));

    const suppressHighlightsLabel = document.createElement("label");
    suppressHighlightsLabel.style.cssText = "display:flex;align-items:center;gap:9px;color:var(--text-normal);font-size:13px;cursor:pointer";
    const suppressHighlights = document.createElement("input");
    suppressHighlights.type = "checkbox";
    suppressHighlights.checked = current.notify_highlights === 2;
    suppressHighlightsLabel.append(suppressHighlights, document.createTextNode("Suppress highlights"));

    const muteEventsLabel = document.createElement("label");
    muteEventsLabel.style.cssText = "display:flex;align-items:center;gap:9px;color:var(--text-normal);font-size:13px;cursor:pointer";
    const muteEvents = document.createElement("input");
    muteEvents.type = "checkbox";
    muteEvents.checked = current.mute_scheduled_events ?? false;
    muteEventsLabel.append(muteEvents, document.createTextNode("Mute new events"));

    const mobilePushLabel = document.createElement("label");
    mobilePushLabel.style.cssText = "display:flex;align-items:center;gap:9px;color:var(--text-normal);font-size:13px;cursor:pointer";
    const mobilePush = document.createElement("input");
    mobilePush.type = "checkbox";
    mobilePush.checked = current.mobile_push ?? true;
    mobilePushLabel.append(mobilePush, document.createTextNode("Mobile push notifications"));

    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;align-items:center;gap:10px";
    const save = document.createElement("button");
    save.textContent = "Apply";
    save.style.cssText = "border:0;border-radius:7px;padding:8px 13px;background:var(--brand-500);color:white;font-weight:600;cursor:pointer";
    const status = document.createElement("span");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "color:var(--text-muted);font-size:12px";
    footer.append(save, status);

    save.addEventListener("click", async () => {
      save.disabled = true;
      status.textContent = "Updating…";
      try {
        await this.updateGuild(guild.id, this.buildNotificationSettings({
          level: Number(select.value),
          suppressEveryone: suppress.checked,
          suppressRoles: suppressRoles.checked,
          suppressHighlights: suppressHighlights.checked,
          muteScheduledEvents: muteEvents.checked,
          mobilePush: mobilePush.checked
        }));
        status.textContent = "Saved";
        BdApi.UI.showToast(`Updated ${guild.name}`, { type: "success" });
      } catch (error) {
        console.error(`[Server Signals] Could not update guild ${guild.id}`, error);
        status.textContent = "Update failed";
        BdApi.UI.showToast(`Could not update ${guild.name}`, { type: "error" });
      } finally {
        save.disabled = false;
      }
    });

    controls.append(
      levelLabel,
      suppressLabel,
      suppressRolesLabel,
      suppressHighlightsLabel,
      muteEventsLabel,
      mobilePushLabel,
      footer
    );
    details.append(summary, controls);
    return details;
  }

  getSettingsPanel() {
    const root = document.createElement("div");
    root.style.cssText = "padding:16px 8px;color:var(--text-normal);max-width:640px";

    const title = document.createElement("h2");
    title.textContent = "Set every server at once";
    title.style.cssText = "margin:0 0 6px;font-size:20px";

    const copy = document.createElement("p");
    copy.textContent = "Choose a notification level. Channel-specific overrides are left unchanged.";
    copy.style.cssText = "margin:0 0 20px;color:var(--text-muted);line-height:1.5";

    const choices = document.createElement("div");
    choices.style.cssText = "display:grid;gap:8px;margin-bottom:18px";

    this.levels.forEach((level) => {
      const label = document.createElement("label");
      label.style.cssText = "display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;background:var(--background-secondary)";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "server-signals-level";
      input.value = String(level.value);
      input.checked = level.value === this.selectedLevel;
      input.addEventListener("change", () => { this.selectedLevel = level.value; });

      const text = document.createElement("span");
      text.innerHTML = `<strong style="display:block;margin-bottom:3px">${level.label}</strong><span style="color:var(--text-muted);font-size:13px">${level.detail}</span>`;

      label.append(input, text);
      choices.append(label);
    });

    const suppressLabel = document.createElement("label");
    suppressLabel.style.cssText = "display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:8px;border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;background:var(--background-secondary)";
    const suppressInput = document.createElement("input");
    suppressInput.type = "checkbox";
    suppressInput.checked = this.suppressEveryone;
    suppressInput.addEventListener("change", () => {
      this.suppressEveryone = suppressInput.checked;
    });
    const suppressText = document.createElement("span");
    suppressText.innerHTML = '<strong style="display:block;margin-bottom:3px">Suppress @everyone and @here</strong><span style="color:var(--text-muted);font-size:13px">Prevent these mass mentions from notifying you.</span>';
    suppressLabel.append(suppressInput, suppressText);

    const suppressRolesLabel = document.createElement("label");
    suppressRolesLabel.style.cssText = "display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:8px;border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;background:var(--background-secondary)";
    const suppressRolesInput = document.createElement("input");
    suppressRolesInput.type = "checkbox";
    suppressRolesInput.checked = this.suppressRoles;
    suppressRolesInput.addEventListener("change", () => {
      this.suppressRoles = suppressRolesInput.checked;
    });
    const suppressRolesText = document.createElement("span");
    suppressRolesText.innerHTML = '<strong style="display:block;margin-bottom:3px">Suppress all role @mentions</strong><span style="color:var(--text-muted);font-size:13px">Prevent role mentions from sounding off in this server.</span>';
    suppressRolesLabel.append(suppressRolesInput, suppressRolesText);

    const suppressHighlightsLabel = document.createElement("label");
    suppressHighlightsLabel.style.cssText = "display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:8px;border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;background:var(--background-secondary)";
    const suppressHighlightsInput = document.createElement("input");
    suppressHighlightsInput.type = "checkbox";
    suppressHighlightsInput.checked = this.suppressHighlights;
    suppressHighlightsInput.addEventListener("change", () => {
      this.suppressHighlights = suppressHighlightsInput.checked;
    });
    const suppressHighlightsText = document.createElement("span");
    suppressHighlightsText.innerHTML = '<strong style="display:block;margin-bottom:3px">Suppress highlights</strong><span style="color:var(--text-muted);font-size:13px">Disable Discord highlight notifications for this server.</span>';
    suppressHighlightsLabel.append(suppressHighlightsInput, suppressHighlightsText);

    const muteEventsLabel = document.createElement("label");
    muteEventsLabel.style.cssText = "display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:8px;border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;background:var(--background-secondary)";
    const muteEventsInput = document.createElement("input");
    muteEventsInput.type = "checkbox";
    muteEventsInput.checked = this.muteScheduledEvents;
    muteEventsInput.addEventListener("change", () => {
      this.muteScheduledEvents = muteEventsInput.checked;
    });
    const muteEventsText = document.createElement("span");
    muteEventsText.innerHTML = '<strong style="display:block;margin-bottom:3px">Mute new events</strong><span style="color:var(--text-muted);font-size:13px">Do not notify when a new server event is created.</span>';
    muteEventsLabel.append(muteEventsInput, muteEventsText);

    const mobilePushLabel = document.createElement("label");
    mobilePushLabel.style.cssText = "display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:18px;border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;background:var(--background-secondary)";
    const mobilePushInput = document.createElement("input");
    mobilePushInput.type = "checkbox";
    mobilePushInput.checked = this.mobilePush;
    mobilePushInput.addEventListener("change", () => {
      this.mobilePush = mobilePushInput.checked;
    });
    const mobilePushText = document.createElement("span");
    mobilePushText.innerHTML = '<strong style="display:block;margin-bottom:3px">Mobile push notifications</strong><span style="color:var(--text-muted);font-size:13px">Send this server’s notifications to your phone.</span>';
    mobilePushLabel.append(mobilePushInput, mobilePushText);

    const warning = document.createElement("p");
    warning.textContent = "This updates your account immediately and may take a few seconds for large server lists.";
    warning.style.cssText = "font-size:12px;color:var(--text-muted);margin:0 0 12px";

    const button = document.createElement("button");
    button.textContent = "Apply to all servers";
    button.style.cssText = "border:0;border-radius:8px;padding:10px 16px;background:var(--brand-500);color:white;font-weight:600;cursor:pointer";

    const status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "min-height:20px;margin:12px 0 0;color:var(--text-muted);font-size:13px";

    button.addEventListener("click", () => {
      BdApi.UI.showConfirmationModal(
        "Update all servers?",
        `This will set every server to “${this.levels.find((item) => item.value === this.selectedLevel).label}” and apply the selected mention, highlight, event, and mobile push options.`,
        {
          confirmText: "Update all",
          cancelText: "Cancel",
          danger: false,
          onConfirm: () => this.applyToAll(
            this.selectedLevel,
            this.suppressEveryone,
            this.suppressRoles,
            this.suppressHighlights,
            this.muteScheduledEvents,
            this.mobilePush,
            status,
            button
          )
        }
      );
    });

    const divider = document.createElement("div");
    divider.style.cssText = "height:1px;margin:28px 0;background:var(--border-subtle)";

    const serverTitle = document.createElement("h3");
    serverTitle.textContent = "Individual servers";
    serverTitle.style.cssText = "margin:0 0 6px;font-size:17px";

    const serverCopy = document.createElement("p");
    serverCopy.textContent = "Select a server to quickly change only its notification settings.";
    serverCopy.style.cssText = "margin:0 0 14px;color:var(--text-muted);font-size:13px";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search servers";
    search.setAttribute("aria-label", "Search servers");
    search.style.cssText = "box-sizing:border-box;width:100%;margin-bottom:10px;padding:10px 12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--background-secondary);color:var(--text-normal)";

    const serverList = document.createElement("div");
    serverList.style.cssText = "display:grid;gap:8px;max-height:440px;overflow:auto;padding-right:4px";
    const guilds = Object.values(this.getGuildStore()?.getGuilds?.() || {})
      .sort((a, b) => a.name.localeCompare(b.name));
    guilds.forEach((guild) => serverList.append(this.createServerRow(guild)));

    const empty = document.createElement("p");
    empty.textContent = guilds.length ? "No matching servers." : "No servers found.";
    empty.style.cssText = `display:${guilds.length ? "none" : "block"};margin:16px 0;color:var(--text-muted);text-align:center;font-size:13px`;

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      Array.from(serverList.children).forEach((row) => {
        const matches = row.dataset.guildName.includes(query);
        row.style.display = matches ? "block" : "none";
        if (matches) visible++;
      });
      empty.style.display = visible ? "none" : "block";
    });

    root.append(
      title,
      copy,
      choices,
      suppressLabel,
      suppressRolesLabel,
      suppressHighlightsLabel,
      muteEventsLabel,
      mobilePushLabel,
      warning,
      button,
      status,
      divider,
      serverTitle,
      serverCopy,
      search,
      serverList,
      empty
    );
    return root;
  }
};
