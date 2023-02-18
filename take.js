module.exports = function (RED) {

    const cooldown = (node, resetTimeout, maxTry, sendLastSkippedMsg) => {
        const cooldownTime =  (node.startTime + resetTimeout * 1000) - new Date().getTime();
        if (cooldownTime > 0) {
            const fill = node.counter > maxTry ? 'red' : 'green';
            node.status({ fill, shape: 'ring', text: `${node.counter}/${maxTry} - ${Math.round(cooldownTime / 1000)}s` });
            node.subscription = setTimeout(() => cooldown(node, resetTimeout, maxTry), 1000);
        } else {
            node.counter = 0;
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
        const maxTry = config.attempts;
        const resetTimeout = config.timeout;
        const sendLastSkippedMsg = config.sendLastSkippedMsg;

        node.status({ fill: 'green', shape: 'dot', text: `0/${maxTry}` });

        node.on('input', (msg) => {

            node.startTime = new Date().getTime();

            if (node.subscription) {
                clearTimeout(node.subscription);
            }

            if (msg?.resetTimer) {
                node.counter = 0;
                node.status({ fill: 'green', shape: 'dot', text: `0/${maxTry}` });
                node.lastSkippedMsg = null;
            } else {
                node.counter = node.counter || 0;
                node.counter++;

                if (node.counter > maxTry) {
                    node.send([null, msg]);
                    node.status({ fill: 'red', shape: 'dot', text: `${node.counter}/${maxTry} ${resetTimeout}s` });
                    node.lastSkippedMsg = msg;
                } else {
                    node.send([msg, null]);
                    node.status({ fill: 'green', shape: 'ring', text: `${node.counter}/${maxTry} ${resetTimeout}s` });
                    node.lastSkippedMsg = null;
                }
                node.subscription = setTimeout(() => cooldown(node, resetTimeout, maxTry, sendLastSkippedMsg), (resetTimeout % 1000) || 1000);
            }

            if (node.done) {
                node.done();
            }
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
