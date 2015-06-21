angular.module('server').service('profileCache', function(server, _) {
    var that = this;

    that.cache = {};
    that.cacheUid = {};
    that.me = {};

    that.add = function(profile) {
        console.log('adding profile', profile);
        if(profile && profile.id != 0) {
            var alreadyUser = that.cache[profile.id];
            if(!alreadyUser) alreadyUser = {};
            alreadyUser = that.cache[profile.id] = _.extend(alreadyUser, profile);
            that.cacheUid[profile.uid] = alreadyUser;

            if(server.me && server.me.id == profile.id)
                that.me = alreadyUser;
        }
    };

    that.getById = function(profileID) {
        return that.cache[profileID];
    };

    that.getByUid = function(uid) {
        return that.cacheUid[uid];
    };

    that.loadById = function(id, callback) {
        var profile = null;
        if(profile = that.getById(id)) {
            if(callback) callback(profile);
        } else {

        }

    };

    server.eventScope.$on(server.EVENT_ANSWER + 'user', function(event, data) {
        that.add(data);
    });

});
