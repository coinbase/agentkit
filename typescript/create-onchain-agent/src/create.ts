#!/usr/bin/env node
import { initProject } from "./actions/initProject.js";

/**
 * Handles command line arguments and executes the appropriate action
 */
async function handleArgs() {
  await initProject();
}

handleArgs().catch(e => {
  console.error(e);
});
