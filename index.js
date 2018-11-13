#!/usr/bin/env node

/**
 * Copyright [2018] [Joseph B. Phillips]
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); 
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software 
 * distributed under the License is distributed on an "AS IS" BASIS, 
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
 * See the License for the specific language governing permissions and 
 * limitations under the License.
 */

const argv = require( 'argv' );
const util = require('util');
const { exec } = require('child_process');

const validThresholds = [ 'low', 'moderate', 'high', 'critical' ];

const options = [
  {
    name: 'threshold',
    short: 't',
    type: 'string',
    description: 'The threshold at which the audit should fail the build (low, moderate, high, critical)',
    example: "'npm-audit-ci-wrapper --threshold=high' or 'npm-audit-ci-wrapper -t high'"
  },
  {
    name: 'ignore-dev-dependencies',
    short: 'p',
    type: 'boolean',
    description: 'Tells the tool to ignore dev dependencies and only fail the build on runtime dependencies which exceed the threshold',
    example: "'npm-audit-ci-wrapper -p' or 'npm-audit-ci-wrapper --ignore-dev-dependencies'"
  },
  {
    name: 'json',
    short: 'j',
    type: 'boolean',
    description: 'Do not fail, just output the filtered JSON data which matches the specified threshold/scope',
    example: "'npm-audit-ci-wrapper --threshold=high -p --json' or 'npm-audit-ci-wrapper -j'"
  }
];

let args = argv.option( options ).run();

// Check to see if this script should ignore dev dependencies
let ignoreDev = false;

if (args.options.hasOwnProperty('ignore-dev-dependencies')) { // IF the argument was passed
  if (args.options['ignore-dev-dependencies']) {              // IF the argument was set to TRUE
    ignoreDev = true;
  }
}

// Define which threshold this script should cause a non-zero exit status
let threshold = 3;
let formattedThreshold = validThresholds.indexOf('critical');

if (args.options.hasOwnProperty('threshold')) {               // IF the argument was passed
  formattedThreshold = args.options.threshold.toLocaleLowerCase();
  if (validThresholds.indexOf(formattedThreshold) > -1) {   // IF the argument is a valid option
    threshold = validThresholds.indexOf(formattedThreshold);         // Set the threshold
  }
}

// Execute `npm audit --json` and capture the output for processing
exec('npm audit --json', (err, stdout, stderr) => {
  if (err === null) {
    console.log('An unexpected error has occurred')
    console.log(stderr);
  } else {
    let data = JSON.parse(stdout);
    let advisories = Object.entries(data.advisories);

    let flaggedDepenencies = advisories.filter((advisory, idx) => { // Filter dev dependecies if that option is selected
      return (!(advisory[1].findings[0].dev && ignoreDev));
    }).filter((advisory, idx) => {                                  // Filter advisories which are below the selected threshold
      return (validThresholds.indexOf(advisory[1].severity) >= threshold);
    });
    
    if (args.options.hasOwnProperty('json') && args.options.json) {
      var retVal = data;
      retVal.advisories = {};
      retVal.advisories = flaggedDepenencies;
      console.log(JSON.stringify(retVal));
    } else {
      let exitCode = 0;
      if (flaggedDepenencies.length > 0) {
        console.log('There are vulnerable dependencies which exceed the selected threshold and scope:');
        exitCode = 1;
      }
      flaggedDepenencies.forEach((advisory) => {                      // Print out dependencies which exceed the threshold
        let libraryName = advisory[1].module_name;
        let libraryVersion = advisory[1].findings[0].version;
        let advisoryOverview = 'https://www.npmjs.com/advisories/' + advisory[0];
        let severity = advisory[1].severity;
        console.log(util.format("    %s(%s): %s (%s >= %s)", libraryName.padStart(30), libraryVersion.padEnd(20), advisoryOverview.padEnd(50), severity, validThresholds[threshold]));
      });
      
      process.exit(exitCode);
    }
  }
});