module.exports = function (RED) {

    const log = (node, message) => {
        // console.debug(message);
    }
    const cooldown = (node, resetTimeout, maxTry, sendLastSkippedMsg) => {
        const cooldownTime = (node.startTime + resetTimeout) - new Date().getTime();
        log(this, `cooldown() - cooldownTime: ${cooldownTime}`);
        if (cooldownTime > 0) {
            const fill = node.counter > maxTry ? 'red' : 'green';
            node.status({ fill, shape: 'ring', text: `${node.counter}/${maxTry} - ${Math.round(cooldownTime / 1000)}s` });
            node.subscription = setTimeout(() => cooldown(node, resetTimeout, maxTry, sendLastSkippedMsg), 1000);
        } else {
            log(node, `cooldown() - will resend. ${sendLastSkippedMsg} ${node.lastSkippedMsg?.payload}`);
            node.counter = 0;
            node.startTime = null;
            node.status({ fill: 'green', shape: 'dot', text: `0/${maxTry}` });
            if (sendLastSkippedMsg && node.lastSkippedMsg) {
                node.send([node.lastSkippedMsg, null]);
                node.lastSkippedMsg = null;
            }
            if (node.done) {
                node.done();
            }
        }
    }

    function takeNode(config) {

        RED.nodes.createNode(this, config);
        const node = this;
        let maxTry = config.attempts;
        let resetTimeout = config.timeout * 1000; // in ms
        let sendLastSkippedMsg = config.sendLastSkippedMsg;
        let restartTimerOnInput = config.restartTimerOnInput;

        node.status({ fill: 'green', shape: 'dot', text: `0/${maxTry}` });

        const finish = () => {
            if (node.done) {
                node.done();
            }
        }

        node.on('input', (msg) => {
            log(this, `node.on('input') - input ${msg.payload}`);
            // override config
            if (msg.config) {
                maxTry = msg.config.maxTry ?? maxTry;
                resetTimeout = msg.config.resetTimeout ?? resetTimeout;
                sendLastSkippedMsg = msg.config.sendLastSkippedMsg ?? sendLastSkippedMsg;
                restartTimerOnInput = msg.config.restartTimerOnInput ?? restartTimerOnInput;
            }

            // (re)set startTime or calc remaining time for cooldown
            if (restartTimerOnInput || !node.startTime) {
                log(this, `node.on('input') - set startTime`);
                node.startTime = new Date().getTime();
            } else {
                log(this, `node.on('input') - recalc resetTimeout: ${node.startTime} + ${resetTimeout} - ${new Date().getTime()} = ${node.startTime + resetTimeout - new Date().getTime()}`);
                resetTimeout = node.startTime + resetTimeout - new Date().getTime();
            }

            // unsubscribe timeout for cooldown if exists
            if (node.subscription) {
                log(this, 'node.on(\'input\') - clear subscription');
                clearTimeout(node.subscription);
            }

            // if resetTimer: reset state
            if (msg?.resetTimer) {
                log(this, 'node.on(\'input\') - is resetTimer');
                node.counter = 0;
                node.status({ fill: 'green', shape: 'dot', text: `0/${maxTry}` });
                node.lastSkippedMsg = null;
                node.startTime = null;
                return finish();
            }

            // increment counter (for visualisation and to decide whether to pass msg or not
            log(this, `node.on('input') - counter: ${node.counter}`);
            node.counter = node.counter || 0;
            node.counter++;

            if (node.counter > maxTry) {
                log(this, `node.on('input') - counter > maxTry: ${node.counter} > ${maxTry}, status: ${node.counter}/${maxTry} ${resetTimeout}s`);
                node.send([null, msg]);
                node.status({ fill: 'red', shape: 'dot', text: `${node.counter}/${maxTry} ${resetTimeout}s` });
                node.lastSkippedMsg = msg;
            } else {
                log(this, `node.on('input') - counter <= maxTry: ${node.counter} <= ${maxTry}, status: ${node.counter}/${maxTry} ${resetTimeout}s`);
                node.send([msg, null]);
                node.status({ fill: 'green', shape: 'ring', text: `${node.counter}/${maxTry} ${resetTimeout}s` });
                node.lastSkippedMsg = null;
            }
            log(this, `node.on('input') - setTimeout for cooldown with ms: ${(resetTimeout % 1000) || 1000}`);
            node.subscription = setTimeout(() => cooldown(node, resetTimeout, maxTry, sendLastSkippedMsg), (resetTimeout % 1000) || 1000);
            finish();
        });

        node.on('close', (removed, done) => {
            if (node.subscription) {
                clearTimeout(node.subscription);
            }
            if (done && typeof done === 'function') {
                done();
            }
        });
    }

    RED.nodes.registerType("take", takeNode);
}
