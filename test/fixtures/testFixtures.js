var fixtures = JSON.parse(unescape(casper.cli.options["fixtures"]));

var run = function(fixture, index){
    casper.test.begin('Fixture test #' + index, 3, function suite(test) {
        casper.start('test/fixtures/basicSite.html', function() {
            test.assertTitle(fixture.title);
            test.assertSelectorHasText('h1', fixture.h1);
            test.assertSelectorHasText('p', fixture.p);
        });

        casper.run(function() {
            test.done();
        });

    });
};

for(var i = 0; i < fixtures.length; i++){
    run(fixtures[i], i);
}