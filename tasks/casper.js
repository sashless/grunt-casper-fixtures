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
                        file.src.forEach(function (srcFile) {
                            var fixture = getFixture(srcFile, options.fixtures, fileConcurrency);
                            if (fixture) {
                                fixtures[srcFile] = [];
                                fixture.forEach(function (item) {
                                    file.src.push(srcFile);
                                    fixtures[srcFile].push(item);
                                });
                            }
                        });
                        grunt.util.async.forEachLimit(file.src, fileConcurrency, function (srcFile, next) {
                            if (typeof fixtures[srcFile] !== 'undefined') {
                                options.fixture = fixtures[srcFile].pop();
                            }else{
                                delete options.fixture;
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

        if (options.fixtures) {
            delete options.fixtures;
        }
    });
};