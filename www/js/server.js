var sv = angular.module('server', ['ionic', 'config', 'util', 'social', 'underscore']);

function Answer(rawData)
{
    this.rawData = rawData.data;
    this.getAnswer = function(name) {
        var a = this.rawData['answers'];
        if(a)
            for(var i = 0; i < a.length; ++i)
                if(a[i][name])
                    return a[i][name];
        return null;
    };

    this.getAllAnswers = function(name) {
        var a = this.rawData['answers'];
        var res = [];
        if(a)
            for(var i = 0; i < a.length; ++i)
                if(a[i][name])
                    res.push(a[i][name]);
        return res;
    };

    this.isGood = function() {
        var r = this.rawData;
        return r && r.result && r.result == 'good';
    };
}

sv.service('server', function($http, config, $rootScope, socialProvider, util, $interval, _, $q) {

    var that = this;

    that.methodsWithNoSession = [
        'prices',
        'login'
    ];
    that.sessionKey = '';
    that.sessionAcquireTS = 0;
    that.eventScope = $rootScope.$new();

    var pushStream = new PushStream({
        host: config.host + '/push',
        timeout: 25000,
        modes: 'websocket|longpolling'
    });

    function reconnectSocket()
    {
        pushStream.disconnect();
        pushStream.removeAllChannels();
        pushStream.addChannel('balda_' + that.me.id);
        pushStream.connect();
    }

    pushStream.onmessage = function(data) {
        util.log('server', 'PushStream data: ' + data);
    };
    pushStream.onerror = function(err) {
        util.log('server', 'PushStream error: ' + err);
        $interval(function () {
            if(that.isLoggedIn()) {
                reconnectSocket();
            }
        }, 5000, 1);
    };
    pushStream.onstatuschange = function(status) {
        util.log('server', 'PushStream status: ' + status);
    };

    var ERROR_BAD_SESSION = -1013;
    var SESSION_EXPIRATION = 60 * 59; // 59 min

    that.EVENT_LOGGIN_IN_STATUS = 'serverLoggingIn';
    that.EVENT_ANSWER = 'serverAnswer:';
    that.EVENT_SERVER_ERROR = 'serverError';
    that.START = 'start';
    that.END = 'end';

    function rawPromise(data) {
        return $http.post(config.server, data).then(function (data) {
            return new Answer(data);
        });
    }

    that.isSessionExpired = function() {
        return (util.now() - that.sessionAcquireTS) > SESSION_EXPIRATION;
    };

    function publishAnswerEvent(name, data) {
        that.eventScope.$broadcast(that.EVENT_ANSWER + name, data);
    }

    function processAnswers(r) {
        var answers = r.rawData['answers'];
        for(var i = 0; i < answers.length; ++i) {
            var a = answers[i];
            var keys = _.keys(a);
            if(keys.length > 0)
                publishAnswerEvent(keys[0], a[keys[0]]);
        }
    }

    that.rawRequest = function(data) {
        util.log('server', 'Server Request: ', data);

        if(!_.contains(that.methodsWithNoSession, data.method))
            data.session = that.sessionKey;

        return rawPromise(data).then(function (r) {
            if(!r.isGood()) {
                that.onError(r, 'logic');
                return $q.reject(r);
            } else {
                util.log('server', 'Server Response: ', r.rawData);
                processAnswers(r);
            }
            return r;
        }, function (r) {
            that.onError(r, 'inet');
            return r;
        });
    };

    that.request = that.rawRequest;

    function hasSession() {
        return that.sessionKey != '';
    }

    that.isLoggedIn = function() {
        return hasSession() && !that.isSessionExpired();
    };

    var loggingIn = false;

    that.login = function() {

        if(loggingIn) {
            util.log('server', 'login exit; already in progess...');
            return;
        }

        var loginData = socialProvider.getLoginData();
        loginData.method = 'login';

        loggingIn = true;
        util.log('server', 'logging in...');

        that.eventScope.$broadcast(that.EVENT_LOGGIN_IN_STATUS, that.START);
        that.rawRequest(loginData).then(function(r) {
            that.me = r.getAnswer('user');
            that.sessionKey = r.getAnswer('login').sid;
            that.sessionAcquireTS = util.now();
            reconnectSocket();
            publishAnswerEvent('user', that.me);
        }).finally(function() {
            loggingIn = false;
            that.eventScope.$broadcast(that.EVENT_LOGGIN_IN_STATUS, that.END);
        });
    };

    that.onError = function(r, type) {
        var result = r;
        if(r instanceof Answer)
            result = r.rawData;
        result.type = type;

        util.log('server', 'Server error (' + type + '): ', JSON.stringify (result) );

        that.eventScope.$broadcast(that.EVENT_SERVER_ERROR, result);
    };

    that.logout = function() {
        that.sessionKey = '';
        that.sessionAcquireTS = 0;

        pushStream.disconnect();
        pushStream.removeAllChannels();
    };

    that.logout();

    $interval(function() {
        if(hasSession() && that.isSessionExpired()) {
            util.log('server', 'Server: session expired!');
            that.login();
        }
    }, 5000);
});

sv.service('prices', function(server, _, util) {
    var that = this;

    var _prices = {};

    that.getAll = function() {
        return _(_prices).clone();
    };

    that.getNumber = function(key, defaultValue) {
        defaultValue = { value: util.thisis(defaultValue, 0) };
        return util.thisis(_prices[key], defaultValue).value;
    };

    that.getString = function(key, defaultValue) {
        defaultValue = { stringValue: util.thisis(defaultValue, '') };
        return util.thisis(_prices[key], defaultValue).stringValue;
    };

    that.load = function() {
        return server.request({
            method: 'prices'
        }).then(function (r) {
            var prices = r.getAnswer('prices');
            angular.forEach(prices, function (v, k) {
                v.name = k;
            });
            _prices = prices;
        });
    };
});