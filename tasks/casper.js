/*global require */
"use strict";

module.exports = function (grunt) {

    //casper spawn helpers
    var casperlib = require('./lib/casper').init(grunt);
    //get the duration of each casper task
    var Duration = require("duration");
    // path resolver
    var path = require('path');

    Array.prototype.chunk = function (chunkSize) {
        var R = [];
        for (var i = 0; i < this.length; i += chunkSize)
            R.push(this.slice(i, i + chunkSize));
        return R;
    };

    grunt.registerMultiTask('casper', 'execute casperjs tasks', function () {
        var args = Array.prototype.slice.call(arguments),
            options = this.options(),
            done = this.async(),
            taskName = this.nameArgs,
            startTime = new Date();

        //Once Current Task is complete
        //Log Duration and Finish
        function taskComplete(error) {
            var msg = "Casper Task '" + taskName + "' took ~" + new Duration(startTime).milliseconds + "ms to run";
            grunt.log.success(msg);
            if (error) {
                return done(false);
            }
            done();
        }

        grunt.verbose.writeflags(args, 'Arguments');

        var fixtureDir = false;

        if (options.fixtureDir) {
            fixtureDir = options.fixtureDir;
            delete options.fixtureDir;
        }

        var chunkSize = 10;

        if (options.chunkSize) {
            chunkSize = options.chunkSize;
            delete options.chunkSize;
        }

        var getFixture = function (file, chunkSize) {
            // because its not a string
            var splitStore = path.resolve(file).split('/');
            var fileName = splitStore.pop().replace('.js', '.json');

            var fixture = path.resolve(fixtureDir + '/' + fileName);
            // file exists ?
            grunt.verbose.writeln(' ==> fixture file ' + fixture);
            if (grunt.file.exists(fixture)) {
                var fixtureData = grunt.file.readJSON(fixture);
                return fixtureData.chunk(chunkSize);
            }

            return false;
        };


        this.files.forEach(function (file) {
            if (file.src.length) {
                //Allow Files in each task to be run concurrently
                if (options.parallel) {
                    //Don't Pass this through to spawn
                    delete options.parallel;
                    //https://github.com/gruntjs/grunt-contrib-sass/issues/16
                    //Set Default Concurrency at 5 (Supposed Memory Leak > 10)
                    var fileConcurrency = 5;
                    if (options.concurrency) {
                        if (options.concurrency > 10) {
                            grunt.verbose.writeln('Concurrency Too High. Max 10, updating to 10.');
                            fileConcurrency = 10;
                        } else if (options.concurrency < 1) {
                            grunt.verbose.writeln('Concurrency Too Low. Min 1, updating to default 5.');
                        } else {
                            fileConcurrency = options.concurrency;
                        }
                        //Don't Pass this through to spawn
                        delete options.concurrency;
                    }

                    var dest = file.dest !== 'src' ? file.dest : null;
                    //Run Tests In Parallel
                    if (file.src) {
                        var fixtures = [];
                        if(fixtureDir){
                            file.src.forEach(function (srcFile) {
                                grunt.verbose.writeln(' ==> src file ' + srcFile);
                                var fixture = getFixture(srcFile, chunkSize);
                                if (fixture) {
                                    // if just one item is there
                                    fixtures[srcFile] = [fixture.pop()];
                                    // for multiple items
                                    fixture.forEach(function (item, index) {
                                        //because its already there one time
                                        if (index < fixture.length - 1) {
                                            file.src.push(srcFile);
                                        }
                                        fixtures[srcFile].push(item);
                                    });
                                }
                            });
                        }

                        grunt.util.async.forEachLimit(file.src, fileConcurrency, function (srcFile, next) {
                            if (options.fixtures) {
                                delete options.fixtures;
                            }

                            if (typeof fixtures[srcFile] !== 'undefined' && fixtures[srcFile].length) {
                                options.fixtures = escape(JSON.stringify(fixtures[srcFile].pop()));
                                grunt.log.ok(' ==> Fixture parts left ' + fixtures[srcFile].length + ' for file ' + srcFile);
                            }

                            casperlib.execute(srcFile, dest, options, args, next);
                        }, function (err) {
                            if (err) grunt.log.write('error:', err);
                            //Call Done and Log Duration
                            taskComplete(err);
                        });
                    }
                } else {
                    if (file.src) {
                        casperlib.execute(file.src, file.dest, options, args, function (err) {
                            taskComplete(err);
                        });
                    }
                }
            } else {
                grunt.fail.warn('Unable to compile; no valid source files were found.');
            }
        });
    });
};