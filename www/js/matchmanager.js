var mm = angular.module('balda');

mm.service('mm', function() {
    var that = this;
    that.reloadMatches = function() {

    };
});

mm.controller('matchlistController', function ($scope, $ionicHistory) {

    var m = $scope.model = {};

    function makeSeparator(type)
    {
        return {
            type: 'separator',
            group: type
        };
    }

    $scope.model.matches = [
        makeSeparator('my'),
        makeSeparator('other'),
        makeSeparator('end')
    ];

    $scope.$on('$ionicView.enter', function() {
        $ionicHistory.clearHistory();
    });


});
