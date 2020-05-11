#! /usr/bin/env node

const request = require('./request');
const clc = require("cli-color");
const Table = require("cli-table");
const cliSelect = require('cli-select');
const baseUrl = 'https://api.runscope.com';
const { Command } = require('commander');
const program = new Command();

program
    .option('-c, --count <integer>', 'Number of results', 10)
    .requiredOption('-t, --token <string>', 'Token or use environment RUNSCOPE_TOKEN', process.env.RUNSCOPE_TOKEN)
    .option('-r, --refresh-time <integer>', 'Refresh time in ms', 120000)
    .option('-w, --watch', 'Watch', false)
    .option('--no-results', 'Hide results', false)
    .parse(process.argv);

const maxResults = program.count;
const token = program.token;
const refreshTime = program.refreshTime;
const watch = program.watch;
const showResults = program.results;

const head = ['Name', 'Status'];

if (showResults) {
    head.push('Latest Results', 'Latest Result Date', 'Success Ratio');
}

const table = new Table({
    head
});

(async () => {
    try {
        let buckets = await getBuckets();

        const bucketKey = (await cliSelect({
            values: getOptions(buckets),
            valueRenderer: value => value.name,
        })).value.key;

        let tests = await getTests(bucketKey);
        let resultPromises = [];

        do {
            let results;

            if (showResults) {
                resultPromises = tests.map(test => getResults(bucketKey, test.id));

                results = await Promise.all(resultPromises);
            }

            table.splice(0, table.length);
            
            tests.forEach((test, index) => {
                let row = [test.name, getLastTestStatus(test.last_run.status)];

                if (showResults) {
                    row.push(
                        results[index]
                            .map(value => getTestStatus(value.result))
                            .join(' '),
                        dateFormat(
                            timestampToDate(results[index][results[index].length - 1].started_at)
                        ),
                        calcRate(results[index]) + '%'
                    );
                }

                table.push(row);
            });

            if (watch) {
                process.stdout.write(clc.reset);
            }

            process.stdout.write(table.toString());

            if (watch) {
                await sleep(refreshTime);
            }
        } while (watch);
    } catch (e) {
        console.log(e.message);
    }
})();

async function getResults(bucketKey, testId) {
    const response = await request(
        `${baseUrl}/buckets/${bucketKey}/tests/${testId}/results?count=${maxResults}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            }
        }
    );

    return response.data;
}

async function getTests(bucketKey) {
    const response = await request(
        `${baseUrl}/buckets/${bucketKey}/tests?count=50`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            }
        }
    );

    return response.data;
}

async function getBuckets() {
    const response = await request(
        `${baseUrl}/buckets`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            }
        }
    );

    return response.data;
}

function calcRate(data) {
    const pass = data.reduce((sum, item) => {
        return item.result === 'pass' ? sum + 1 : sum;
    }, 0);

    return ((pass / maxResults) * 100).toFixed(2);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getOptions(buckets) {
    return buckets.map(value => {
        return {
            name: value.name,
            key: value.key,
        };
    });
}

function getLastTestStatus(status) {
    return status === 'completed' ? clc.green('Passed') : clc.red('Failed');
}

function getTestStatus(result) {
    return result === 'pass' ? clc.bgGreen(' ') : clc.bgRed(' ');
}

function timestampToDate(timestamp) {
    return new Date(timestamp * 1000);
}

function dateFormat(date) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()} at ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}