#!/usr/bin/env node
"use strict";

const fs = require("fs").promises;
const path = require("path");

const buildStats = require("../plugin/build-stats");
const TEMPLATE = require("../plugin/template-types");
const warn = require("../plugin/warn");
const JSON_VERSION = require("../plugin/version");

const argv = require("yargs")
  .strict()

  .option("filename", {
    describe: "Output file name",
    string: true,
    default: "./stats.html",
  })
  .option("title", {
    describe: "Output file title",
    string: true,
    default: "RollUp Visualizer",
  })
  .option("template", {
    describe: "Template type",
    string: true,
    choices: TEMPLATE,
    default: "treemap",
  })
  .option("sourcemap", {
    describe: "Provided files is sourcemaps",
    boolean: true,
  })
  .help().argv;

const listOfFiles = argv._;

const runForPluginJson = async ({ title, template, filename }, files) => {
  if (files.length === 0) {
    throw new Error("Empty file list");
  }

  const fileContents = await Promise.all(
    files.map(async (file) => {
      const textContent = await fs.readFile(file, { encoding: "utf-8" });
      const jsonContent = JSON.parse(textContent);
      return [file, jsonContent];
    })
  );

  const tree = {
    name: "root",
    children: [],
  };
  const nodes = Object.create(null);
  let links = [];

  for (const [file, fileContent] of fileContents) {
    if (fileContent.version !== JSON_VERSION) {
      warn(
        `Version in ${file} is not supported (${fileContent.version}). Current version ${JSON_VERSION}. Skipping...`
      );
      continue;
    }

    if (fileContent.tree.name === "root") {
      tree.children = tree.children.concat(fileContent.tree.children);
    } else {
      tree.children.push(fileContent.tree);
    }

    Object.assign(nodes, fileContent.nodes);

    links = links.concat(fileContent.links);
  }

  const data = {
    version: JSON_VERSION,
    tree,
    links,
    nodes,
    env: fileContents[0].env,
    options: fileContents[0].options,
  };

  const fileContent = await buildStats({
    title,
    data,
    template,
  });

  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, fileContent);
};

runForPluginJson(argv, listOfFiles).catch((err) => {
  warn(err.message);
  process.exit(1);
});
