#!/usr/bin/env node
import { Command } from "commander";
import { toCliError } from "./client/errors.js";
import { registerApiCommands } from "./commands/api.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerCampaignCommands } from "./commands/campaigns.js";
import { getPrintOptions } from "./commands/helpers.js";
import { registerReportCommands } from "./commands/reports.js";
import { printJson } from "./output/print.js";
import { failure } from "./output/shapes.js";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("voluum")
    .description("Community CLI wrapper for public Voluum REST APIs (unofficial)")
    .version("0.1.0")
    .showHelpAfterError()
    .option("--baseUrl <url>", "Override Voluum API base URL")
    .option("--token <token>", "Override auth token for this command")
    .option("--json", "Output as JSON instead of TOON")
    .option("--pretty", "Output as pretty-printed JSON (implies --json)")
    .option("--silent", "Suppress stdout output")
    .option("--out <file>", "Write JSON output to file");

  registerAuthCommands(program);
  registerCampaignCommands(program);
  registerReportCommands(program);
  registerApiCommands(program);

  program.exitOverride();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const maybeCommanderError = error as {
      code?: string;
      exitCode?: number;
      message?: string;
    };

    if (maybeCommanderError.code === "commander.helpDisplayed") {
      process.exitCode = 0;
      return;
    }

    const cliError =
      maybeCommanderError.code === "commander.unknownOption" ||
      maybeCommanderError.code === "commander.missingArgument" ||
      maybeCommanderError.code === "commander.unknownCommand"
        ? {
            message: maybeCommanderError.message ?? "Command parsing error",
            code: "USAGE_ERROR",
          }
        : toCliError(error);

    await printJson(failure(cliError), getPrintOptions(program));
    process.exitCode = cliError.code === "UNEXPECTED" ? 2 : 1;
  }
}

await main();
