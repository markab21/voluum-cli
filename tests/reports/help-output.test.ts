import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { registerReportCommands } from "../../src/commands/reports.js";

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  program
    .option("--baseUrl <url>")
    .option("--token <token>")
    .option("--pretty")
    .option("--silent")
    .option("--out <file>");
  registerReportCommands(program);
  return program;
}

async function renderHelp(args: string[]): Promise<string> {
  let output = "";
  const program = buildProgram();

  program.configureOutput({
    writeOut: (text) => {
      output += text;
    },
    writeErr: (text) => {
      output += text;
    },
  });

  try {
    await program.parseAsync(["node", "voluum", ...args]);
  } catch (error) {
    const commanderError = error as { code?: string };
    if (commanderError.code !== "commander.helpDisplayed") {
      throw error;
    }
  }

  return output;
}

describe("reports command help output", () => {
  test("includes advanced examples and precedence guidance for reports query", async () => {
    const output = await renderHelp(["reports", "query", "--help"]);

    expect(output).toContain("Examples:");
    expect(output).toContain("voluum reports query --path /report/conversions");
    expect(output).toContain("--query from=2026-02-01,to=2026-02-18,limit=100,offset=100,sort=visits:desc");
    expect(output).toContain("--query-json '{\"limit\":25,\"offset\":50,\"sort\":\"visits:asc\"}'");
    expect(output).toContain("--query-json overrides duplicate keys from --query.");
  });

  test("includes schema introspection examples with filters", async () => {
    const output = await renderHelp(["reports", "schema", "--help"]);

    expect(output).toContain("Examples:");
    expect(output).toContain("voluum reports schema --path /report/conversions");
    expect(output).toContain("--groupable --type money --search revenue");
    expect(output).toContain("--restrictable --with-query-params");
  });
});
