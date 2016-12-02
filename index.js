#!/usr/bin/env node
'use strict';

var readline = require('readline');
var pjson = require('./package.json');

function data_to_sites(data)
{
    var ground_truths = Object.keys(data);
/*
    var neighbours_obj = {};
    ground_truths.forEach(function(ground_truth)
    {
        Object.keys(data[ground_truth]).forEach(function(neighbour)
        {
            neighbours_obj[neighbour] = 0;
        });
    });

    var neighbours = [];
    for( var i in neighbours_obj ) {
        neighbours.push(i);
    }
    console.log(ground_truths);
    console.log(neighbours);
*/
    return ground_truths;
}

function confusion_to_latex(sites, confusion_matrix, opt)
{
    var write = function(str)
    {
        process.stdout.write(str);
    }

    var tw = function(str)
    {
        if(opt.array)
        {
            return "\\text{" + str + "}";
        }
        else
        {
            return str;
        }
    }

    var start = function()
    {
        if(opt.array)
        {
            console.log("\\(");
            write("\\begin{array}{");
        }
        else
        {
            write("\\begin{tabular}{");
        }
        console.log("|lcl|" + Array(sites.length+1).join('c|') + "} \\hline");
    }

    var end = function()
    {
        if(opt.array)
        {
            console.log("\\end{array}");
            console.log("\\)");
        }
        else
        {
            console.log("\\end{tabular}");
        }
    }

    var header_line = function()
    {
        write("\\multicolumn{3}{|c|}{" + tw("X") + "}");
        sites.forEach(function(site, index)
        {
            if(opt.alias)
            {
                write(" & " + tw(site));
            }
            else
            {
                write(" & " + tw("(" + index + ")"));
            }
        });
        console.log(" \\\\ \\hline");
    }

    if(opt.standalone)
    {
        console.log("\\documentclass[crop]{standalone}");

        if(options.color)
            console.log("\\usepackage[table]{xcolor}");

        if(options.array)
            console.log("\\usepackage{amsmath}");

        console.log("\\begin{document}");
    }

    start();
    header_line();
    // Confusion matrix itself
    sites.forEach(function(ground, index)
    {
        if(opt.alias)
        {
            write("\\multicolumn{3}{|c|}{" + tw(ground) + "}");
        }
        else
        {
            write(tw(index) + " & : & " + tw(ground));
        }
		if(opt.color)
            var sum = sites.reduce(function(a, b) { return a + (confusion_matrix[ground][b] || 0); }, 0);
        
		sites.forEach(function(neighbor)
        {
            var value = Math.floor(((confusion_matrix[ground] || {})[neighbor] || 0) * 100) / 100;
            if(opt.color && value != 0)
            {
                var color = (ground == neighbor ? "green" : "red");
                var percent = value / sum * 100;

                write(" & \\cellcolor{" + color + "!" + percent + "}" + value);
            }
            else
            {
                write(" & " + value);
            }
        });
        console.log(" \\\\ \\hline");
    });
    end();

    if(opt.standalone)
    {
        console.log("\\end{document}");
    }
}

function confusion_to_accuracy(sites, confusion_matrix, opt)
{
    var trials = 0;
    var accurate = 0;

    Object.keys(confusion_matrix).forEach(function(ground_truth)
    {
        var row = confusion_matrix[ground_truth];
        Object.keys(row).forEach(function(neighbour)
        {
            var count = row[neighbour];
            trials += count;

            if(ground_truth == neighbour)
            {
                accurate += count;
            }
        });
    });

    var accuracy = ((accurate / trials) * 100);

    var result = {};
    result.accuracy = accuracy;

    // Output error
    if(opt.resume > 3)
    {
        console.error();
        console.error("Fatal error: Cannot condense output more than thrice");
        console.error();
        process.exit(1);
    }

    // Add trials and num accurate, unless we're super tiny
    if(opt.resume < 3)
    {
        result.trials = trials;
        result.accurate = accurate;
    }

    // Add precision and recall, unless we're really tiny
    if(opt.resume < 2)
    {
        // NOTE: See http://stats.stackexchange.com/a/51301
        // NOTE: Need more; See https://en.wikipedia.org/wiki/Precision_and_recall#
        var precall = sites.reduce(function(acc, ground_truth)
        {
            // Common nominator
            var nom = ((confusion_matrix[ground_truth] || {})[ground_truth] || 0);
            // Recall
            var denom_recall = sites.reduce(function(acc, neighbour)
            {
                var count = ((confusion_matrix[ground_truth] || {})[neighbour] || 0);
                return acc + count;
            },0);
				// Precision
            var denom_precision = sites.reduce(function(acc, neighbour)
            {
                var count = ((confusion_matrix[neighbour] || {})[ground_truth] || 0);
                return acc + count;
            },0);
            // Set the output
            acc[ground_truth] = {};
            acc[ground_truth].precision = (nom/denom_precision)*100;
            acc[ground_truth].recall = (nom/denom_recall)*100;
            // Return the accumulative object
            return acc;
        }, {});

        result.precall = precall;
    }

    // Print out our result
    console.log(result);
}

function to_percentage(sites, confusion_matrix)
{
	sites.forEach(function(ground, index)
	{
		var sum = sites.reduce(function(a, b) { return a + (confusion_matrix[ground][b] || 0); }, 0);
		sites.forEach(function(neighbor)
        {
            //var value = Math.floor(((confusion_matrix[ground] || {})[neighbor] || 0) * 100) / 100;
            var value = (confusion_matrix[ground] || {})[neighbor] || 0;
            var percent = value / sum * 100;
			if(percent != 0)
				confusion_matrix[ground][neighbor] = percent;
        });

	});
	return confusion_matrix;
}

var options = require('commander');

function increaser(v, total) { return total + 1; };

options
  .version(pjson.version)
  .description(pjson.description + ".")
  .usage('[options]')
  .option('-p, --percentage', 'Print percentages rather than data')
  .option('-,--', '')
  .option('-,--', 'Ground Truth:')
  .option('-g, --ground', 'Output ground truths')
  .option('-,--', '')
  .option('-,--', 'Dump confusion matrix:')
  .option('-C, --confusion', 'Output confusion matrix')
  .option('-,--', '')
  .option('-,--', 'Summary:')
  .option('-r, --resume', 'Print resume of the confusion matrix', increaser, 0)
  .option('-,--', '')
  .option('-,--', 'Latex:')
  .option('-l, --latex', 'Print confusion matrix as LaTeX')
  .option('-s, --standalone', 'Print a self-contained LaTeX document')
  .option('-c, --color', 'Add color to output table')
  .option('-x, --alias', 'Shorten header row for large tables')
  .option('-a, --array', 'Format output as array instead of tabular')
  .option('-h, --help', '');

// Addition help
options.on('--help', function()
{
    console.log('  Examples:');
    console.log('');
    console.log('    $ cat input.json | ./index.js -r \t\t\t# Output a resumé of input.json');
    console.log('    $ cat input.json | ./index.js -lsc | lualatex \t# Generate input.json as pdf file');
    console.log('    $ cat input.json | ./index.js -g \t\t\t# Output a list og ground truths');
    console.log('');
});

// Capture the internal helper
var internal_help = options.help;

// Parse argv
options.parse(process.argv);

// Utilize our modified helper
var help = function()
{
    internal_help.bind(options)(function(value)
    {
        var help = value.split('\n');
        // Find our marker and use it to create categories
        var new_help = help.map(function(line)
        {
            var marker = line.indexOf("-,--");
            if(marker != -1)
            {
                return "   " + line.substr(marker+4).trim();
            }
            return line;
        }).filter(function(line)
        {
            return line.indexOf("-h, --help") == -1;
        });
        //console.log(new_help);

        return new_help.join('\n');
    });
}

// Was -h, or --help passed?
if(options.help == undefined)
    help();

var output_modes = [options.resume, options.latex, options.ground, options.confusion];
var num_modes_selected = output_modes.reduce(function(a,b) { return a + (b ? 1 : 0); }, 0);
if(num_modes_selected == 0)
{
    console.error();
    console.error("Fatal error: No output mode selected!");
    console.error();
    process.exit(1);
}

if(num_modes_selected != 1)
{
    console.error();
    console.error("Fatal error: Cannot utilize two output modes at once!");
    console.error();
    process.exit(1);
}

var read_timeseries = function(callback)
{
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    var input = "";
    rl.on('line', function(line)
    {
        input += line;
    });

    rl.on('close', function()
    {
        var json;
        try
        {
            json = JSON.parse(input);
        }
        catch(err)
        {
            console.error();
            console.error("Fatal error: Piped input is not valid JSON!");
            console.error();
            console.error(err);
            process.exit(1);
        }

        callback(json);
    });
};

read_timeseries(function(json)
{
    var sites = data_to_sites(json);
    if(options.ground)
    {
        console.log(sites);
    }
    var confusion = json;
	if(options.percentage)
		confusion = to_percentage(sites, confusion);
    if(options.confusion)
	    console.log(confusion);
    if(options.latex)
        confusion_to_latex(sites, confusion, options);
    if(options.resume)
        confusion_to_accuracy(sites, confusion, options);
});

