/*global require */
"use strict";

module.exports = function (grunt) {

    //casper spawn helpers
    var casperlib = require('./lib/casper').init(grunt);
    //get the duration of each casper task
    var Duration = require("duration");
    // path resolver
    var path = require('path');

    Array.prototype.chunk = function(chunkSize) {
        var R = [];
        for (var i=0; i<this.length; i+=chunkSize)
            R.push(this.slice(i,i+chunkSize));
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

        var getFixture = function(file){
            // because its not a string
            var splitStore = path.resolve(file.src + '').split('/');
            var fileName = splitStore.pop().replace('.js', '.json');
            var tag = splitStore.pop();
            var fixture = path.resolve(options.fixtures + '/' + tag + '/' + fileName);
            // file exists ?
            if(grunt.file.exists(fixture)){
                return grunt.file.readJSON(fixture);
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
                    var concurrency = 5;
                    if (options.concurrency) {
                        if (options.concurrency > 10) {
                            grunt.verbose.writeln('Concurrency Too High. Max 10, updating to 10.');
                            concurrency = 10;
                        } else if (options.concurrency < 1) {
                            grunt.verbose.writeln('Concurrency Too Low. Min 1, updating to default 5.');
                        } else {
                            concurrency = options.concurrency;
                        }
                        //Don't Pass this through to spawn
                        delete options.concurrency;
                    }

                    //Run Tests In Parallel
                    if (file.src) {
                        //has a fixture
                        var fixture = getFixture(file);
                        if(fixture){
                            fixture = fixture.chunk(concurrency);
                            fixture.forEach(function(fixtureData){
                                options.fixtureData = escape(JSON.stringify(fixtureData));
                                //Spawn Child Process
                                grunt.util.async.forEachLimit(file.src, concurrency, function (srcFile, next) {
                                    casperlib.execute(srcFile, file.dest !== 'src' ? file.dest : null, options, args, next);
                                }, function (err) {
                                    if (err) grunt.log.write('error:', err);
                                    //Call Done and Log Duration
                                    taskComplete(err);
                                });
                            });
                        }else{
                            grunt.util.async.forEachLimit(file.src, concurrency, function (srcFile, next) {
                                casperlib.execute(srcFile, file.dest !== 'src' ? file.dest : null, options, args, next);
                            }, function (err) {
                                if (err) grunt.log.write('error:', err);
                                //Call Done and Log Duration
                                taskComplete(err);
                            });
                        }
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
    });
};