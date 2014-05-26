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

        var getFixture = function (file, fixtureDir, chunkSize) {
            // because its not a string
            var splitStore = path.resolve(file).split('/');
            var fileName = splitStore.pop().replace('.js', '.json');
            var tag = splitStore.pop();
            var fixture = path.resolve(fixtureDir + '/' + tag + '/' + fileName);
            // file exists ?
            if (grunt.file.exists(fixture)) {
                var fixtureData = grunt.file.readJSON(fixture);
                return fixtureData.chunk(chunkSize);
            }

            return false;
        };

        var addFixtureToOptions = function (fixtureData) {
            if (options.fixtures)
                options.fixture = escape(JSON.stringify(fixtureData))
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

                    var originalFileConcurrency = fileConcurrency;
                    //Run Tests In Parallel
                    if (file.src) {
                        grunt.util.async.forEachLimit(file.src, fileConcurrency, function (srcFile, next) {
                            var fixtures = getFixture(srcFile, options.fixtures, 10);
                            if (fixtures) {
                                fileConcurrency = 1;
                                grunt.util.async.forEachLimit(fixtures, 10, function (fixture, nextFixture) {
                                    addFixtureToOptions(fixture);
                                    casperlib.execute(srcFile, file.dest !== 'src' ? file.dest : null, options, args, nextFixture);
                                }, function (err) {
                                    if (err) grunt.log.write('error:', err);
                                    //Call Done and Log Duration
                                    taskComplete(err);
                                });
                            } else {
                                fileConcurrency = originalFileConcurrency;
                                casperlib.execute(srcFile, file.dest !== 'src' ? file.dest : null, options, args, next);
                            }

                        }, function (err) {
                            if (err) grunt.log.write('error:', err);
                            //Call Done and Log Duration
                            taskComplete(err);
                        });
                    }
                } else {
                    if (file.src) {
                        casperlib.execute(file.src, file.dest, options, args, function (err) {
                            //Call Done and Log Duration
                            taskComplete(err);
                        });
                    }
                }
            } else {
                grunt.fail.warn('Unable to compile; no valid source files were found.');
            }
        });

        if (options.fixtures) {
            delete options.fixtures;
        }
    });
};