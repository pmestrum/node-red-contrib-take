var should = require("should");
var helper = require("node-red-node-test-helper");
var takeNode = require("../take.js");

helper.init(require.resolve('node-red'));

describe('take Node', function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it('should be loaded', function (done) {
        var flow = [{ id: "n1", type: "take", name: "take" }];
        helper.load(takeNode, flow, function () {
            var n1 = helper.getNode("n1");
            try {
                n1.should.have.property('name', 'take');
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('should let a message pass if only called once with default config', function (done) {
        var flow = [
            { id: "n1", type: "take", name: "take", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        helper.load(takeNode, flow, function () {
            var n2 = helper.getNode("n2");
            var n1 = helper.getNode("n1");
            n2.on("input", function (msg) {
                try {
                    const now = new Date().getTime();
                    msg.payload.should.belowOrEqual(now + 10);
                    // msg.should.have.property('payload', 'uppercase');
                    done();
                } catch (err) {
                    done(err);
                }
            });
            n1.receive({ payload: new Date().getTime() });
        });
    });

    it('should not let a message pass if called once with attempts = 0', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 0, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        n2.on("input", function (msg) {
            try {
                counter++;
            } catch (err) {
                done(err);
            }
        });
        n1.receive({ payload: new Date().getTime() });
        await sleep(1000);
        (counter).should.be.exactly(0);
    });

    it('should not let a message pass if called twice with attempts = 0', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 0, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        n2.on("input", function (msg) {
            counter++;
        });
        n1.receive({ payload: new Date().getTime() });
        await sleep(500);
        n1.receive({ payload: new Date().getTime() });
        await sleep(500);
        (counter).should.be.exactly(0);
    });

    it('should let two messages pass if called twice with attempts = 2', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 2, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        n2.on("input", function (msg) {
            counter++;
        });
        n1.receive({ payload: new Date().getTime() });
        await sleep(500);
        n1.receive({ payload: new Date().getTime() });
        await sleep(500);
        (counter).should.be.exactly(2);
    });

    it('should let one message pass after timeout, ', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 1, resetTimeout: 1, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        n2.on("input", function (msg) {
            counter++;
        });
        n1.receive({ payload: new Date().getTime() });
        n1.receive({ payload: new Date().getTime() });
        await sleep(100);
        (counter).should.be.exactly(1);
        await sleep(1000);
        n1.receive({ payload: new Date().getTime() });
        await sleep(100);
        (counter).should.be.exactly(2);
    });

    it('should let last message pass after timeout', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 1, resetTimeout: 1, sendLastSkippedMsg: true, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        let lastResponse;
        n2.on("input", function (msg) {
            lastResponse = msg.payload;
            counter++;
        });
        n1.receive({ payload: 1 });
        n1.receive({ payload: 2 });
        n1.receive({ payload: 3 });
        await sleep(100);
        (counter).should.be.exactly(1);
        lastResponse.should.be.exactly(1);
        await sleep(500);
        (counter).should.be.exactly(1);
        lastResponse.should.be.exactly(1);
        await sleep(500);
        (counter).should.be.exactly(2);
        lastResponse.should.be.exactly(3);
    });

    it('should return last received after timeout if attempts = 0 && sendLastSkippedMsg = true, no restart of timer', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 0, timeout: 1.5, sendLastSkippedMsg: true, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        let lastResponse = 0;
        n2.on("input", function (msg) {
            console.log(`test() - input ${msg?.payload} received`);
            lastResponse = msg.payload;
            counter++;
        });
        n1.receive({ payload: 1 });
        // n1.trace.should.be.calledWithExactly('set startTime');
        await sleep(100);
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
        await sleep(500);
        n1.receive({ payload: 2 });
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
        await sleep(1000);
        (counter).should.be.exactly(1);
        lastResponse.should.be.exactly(2);
    });

    it('should work as a debounceTime if attempts = 0 && sendLastSkippedMsg = true, timer restarts on input', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 0, resetTimeout: 1, sendLastSkippedMsg: true, restartTimerOnInput: true, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        let lastResponse = 0;
        n2.on("input", function (msg) {
            console.log(`input ${msg} received`);
            lastResponse = msg.payload;
            counter++;
        });
        n1.receive({ payload: 1 });
        await sleep(100);
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
        await sleep(500);
        n1.receive({ payload: 2 });
        await sleep(50);
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
        await sleep(500);
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
        await sleep(500);
        (counter).should.be.exactly(1);
        lastResponse.should.be.exactly(2);
    });


    it('should send nothing if attempts = 0, sendLastSkippedMsg = true and received a resetTimer = true afterwards', async function () {
        var flow = [
            { id: "n1", type: "take", name: "take", attempts: 0, resetTimeout: 1, sendLastSkippedMsg: true, restartTimerOnInput: true, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        await helper.load(takeNode, flow);
        var n2 = helper.getNode("n2");
        var n1 = helper.getNode("n1");
        let counter = 0;
        let lastResponse = 0;
        n2.on("input", function (msg) {
            console.log(`input ${msg} received`);
            lastResponse = msg.payload;
            counter++;
        });
        n1.receive({ payload: 1 });
        await sleep(100);
        n1.receive({ payload: 2 });
        await sleep(100);
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
        n1.receive({ resetTimer: true });
        await sleep(1200);
        (counter).should.be.exactly(0);
        lastResponse.should.be.exactly(0);
    });



});

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`sleep() - just slept ${ms}ms`);
            resolve();
            }, ms);
    });
}
