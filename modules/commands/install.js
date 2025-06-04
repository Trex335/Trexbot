const fs = require("fs-extra");
const axios = require("axios");
const { resolve, join } = require("path");

module.exports = {
  config: {
    name: "install",
    version: "1.0.0",
    author: "Hassan",
    countDown: 10, // Cooldown to prevent spamming installations
    role: 2, // ONLY ADMINS should be able to use this command due to security risks
    shortDescription: "Installs a new command or event file from a URL.",
    longDescription: "Installs a new command or event file (e.g., .js) by downloading its content from a provided URL and saving it to the appropriate bot directory. USE WITH CAUTION: Only install files from trusted sources.",
    category: "admin",
    guide: {
      en: "  {pn} <filename.js> <URL>: Installs a new command or event file.\n  Example:\n  {pn} movie.js https://pastebin.com/raw/HWWEU68H"
    }
  },

  langs: {
    en: {
      missingArgs: "Please provide both the filename (e.g., command.js) and the direct URL to the file.",
      invalidFilename: "The filename must end with .js",
      downloadFailed: "Failed to download the file from the provided URL. Error: %1",
      fileWriteFailed: "Failed to save the file '%1'. Error: %2",
      successCommand: "Successfully installed command '%1'. The bot might need a restart for it to load.",
      successEvent: "Successfully installed event '%1'. The bot might need a restart for it to load.",
      alreadyExists: "A file named '%1' already exists in %2. Please choose a different name or manually delete the existing file.",
      adminOnly: "This command can only be used by bot administrators due to security risks."
    }
  },

  onStart: async function ({ api, event, args, message, role, getLang }) {
    // Check if the user is an admin (role < 2 means less than admin, so not admin)
    if (role < 2) { // Assuming role 2 or higher is admin as per your prefix command
      return message.reply(getLang("adminOnly"));
    }

    if (args.length < 2) {
      return message.reply(getLang("missingArgs"));
    }

    const filename = args[0];
    const fileUrl = args[1];

    if (!filename.endsWith(".js")) {
      return message.reply(getLang("invalidFilename"));
    }

    const commandsPath = resolve(join(global.client.mainPath, "modules", "commands"));
    const eventsPath = resolve(join(global.client.mainPath, "modules", "events"));

    let targetPath;
    let fileType;

    // Determine if it's a command or an event based on common naming conventions
    // You might want to make this more robust, e.g., by checking file content
    if (filename.startsWith("cmd_") || filename.startsWith("command_") || filename.includes("command")) {
      targetPath = join(commandsPath, filename);
      fileType = "command";
    } else if (filename.startsWith("event_") || filename.includes("event")) {
      targetPath = join(eventsPath, filename);
      fileType = "event";
    } else {
      // Default to commands if unsure, or you can prompt the user
      targetPath = join(commandsPath, filename);
      fileType = "command";
    }

    // Check if the file already exists to prevent overwrites or accidental issues
    if (fs.existsSync(targetPath)) {
        return message.reply(getLang("alreadyExists", filename, fileType === "command" ? "modules/commands" : "modules/events"));
    }


    try {
      // Download the file content
      const response = await axios.get(fileUrl);
      const fileContent = response.data;

      // Save the file
      await fs.writeFile(targetPath, fileContent);

      if (fileType === "command") {
        message.reply(getLang("successCommand", filename));
      } else {
        message.reply(getLang("successEvent", filename));
      }
      global.loading.log(`Installed new ${fileType} file: ${filename}`, "INSTALL");

      // Suggest restart for changes to take effect
      api.sendMessage("It's highly recommended to restart the bot for the new file to take effect. Use the 'restart' command if available.", event.threadID);

    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        message.reply(getLang("downloadFailed", `HTTP Error: ${error.response.status}`));
        global.loading.err(`Failed to download ${filename}: HTTP Error ${error.response.status}`, "INSTALL");
      } else if (error.request) {
        // The request was made but no response was received
        message.reply(getLang("downloadFailed", "No response from URL."));
        global.loading.err(`Failed to download ${filename}: No response from URL.`, "INSTALL");
      } else {
        // Something happened in setting up the request that triggered an Error
        if (error.code === 'ENOENT') { // File not found on local write
             message.reply(getLang("fileWriteFailed", filename, error.message));
        } else {
             message.reply(getLang("downloadFailed", error.message));
        }
        global.loading.err(`Failed to download/install ${filename}: ${error.message}`, "INSTALL");
      }
    }
  }
};
