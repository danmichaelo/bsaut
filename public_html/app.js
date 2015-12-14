'use strict';
 
// Declare app level module which depends on filters, and services
angular.module('app', ['ngRoute', 'infinite-scroll'])

.config(function($routeProvider, $locationProvider) {

  $routeProvider
    .when('/', {
      templateUrl: 'views/index.html',
      controller : 'SearchResultsCtrl'
    })
    .when('/search/:query', {
      templateUrl: 'views/index.html',
      controller : 'SearchResultsCtrl'
    })
    .when('/show/:id', {
      templateUrl: 'views/show.html',
      controller : 'RecordCtrl'
    })
    .otherwise({
      redirectTo: '/'
    });

  // use the HTML5 History API
  $locationProvider.html5Mode(true);

})

.service('ApiService', ['$rootScope', '$http', '$q', function($rootScope, $http, $q) {

  var that = this;

  this.busy = false;
  this.canceler = null;

  this.searchBibsys = function(query) {

    if (that.canceler) {
      console.log('Aborting');
      that.canceler.resolve();
    }

    that.canceler = $q.defer();

    $rootScope.$broadcast('requestStart');
    $rootScope.$broadcast('searchStart', query);
    $http({
      method: 'GET',
      url: 'api.php?q=' + query,
      timeout: that.canceler
    })
    .success(function(response) {
      $rootScope.$broadcast('searchResults', response);
      $rootScope.$broadcast('requestFinish');
     })
    .error(function() {
      $rootScope.$broadcast('requestFinish');
     });
  };

}])

.controller('SearchResultsCtrl', ['$scope', '$routeParams', 'ApiService', function($scope, $routeParams, ApiService) {

  $scope.busy = false;
  $scope.records = [];
  $scope.stat = ''
  $scope.query = $routeParams.query;
 
  $scope.$on('requestStart', function() {
    $scope.busy = true;
  });

  $scope.$on('requestFinish', function() {
    $scope.busy = false;
  });

  $scope.$on('searchResults', function(e, response) {
    console.log('Got results');
    $scope.records = response.records;
    $scope.stat = response.numberOfRecords > response.records.length 
      ? 'Showing ' + response.records.length + ' of ' + response.numberOfRecords + ' record(s) found' 
      : response.records.length + ' record(s) found';
  });

  if ($scope.query) {
    ApiService.searchBibsys($scope.query);
  }

}])

.controller('SearchFormCtrl', ['$scope', '$routeParams', '$location', function($scope, $routeParams, $location, ApiService) {

  $scope.busy = false;
  $scope.query = $routeParams.query;
  $scope.query = '';
 
  $scope.submit = function() {
    $location.path('/search/' + $scope.query);
  };

  $scope.$on('searchStart', function(e, query) {
    console.log('Search start');
    console.log(query);
    $scope.query = query;
  });

  $scope.$on('requestStart', function() {
    $scope.busy = true;
  });

  $scope.$on('requestFinish', function() {
    $scope.busy = false;
  });

}])

.directive('viafLink', function () { 
  return { 
    // We limit this directive to attributes only
    restrict : 'A',

    // We will replace the original element code
    replace : true,
    
    // We must supply at least one element in the code to replace the div
    template : '<td><i class="fa fa-cog fa-spin" ng-show="viafBusy"></i> Checking</td>',

    link: function(scope, element, attrs) {
      scope.$watch('viaf', function(viaf) {
        console.log('VIAF changed');
        if (viaf !== undefined) {          
          if (viaf && viaf.id) {
            element.html('<a href="http://viaf.org/viaf/' + viaf.id + '/">' + viaf.id + '</a> : ' + viaf.mainHeadings.reduce(function(prev, cur) { return (prev ? prev + ' | ' : '') + cur.title; }, null) );
          } else {
            element.html('<em>Record not connected to VIAF</em>');
          }
        }
      })
    }
  }
})

.directive('wdLink', function () { 
  return { 
    // We limit this directive to attributes only
    restrict : 'A',

    // We will replace the original element code
    replace : true,
    
    // We must supply at least one element in the code to replace the div
    template : '<td><i class="fa fa-cog fa-spin" ng-show="wdBusy"></i> Checking</td>',

    link: function(scope, element, attrs) {
      scope.$watch('wikidata', function(wikidata) {
        console.log('wikidata changed');
        if (wikidata !== undefined) {          
          if (wikidata && wikidata.id) {
            element.html('<a href="https://wikidata.org/wiki/Q' + wikidata.id + '">Q' + wikidata.id + '</a> (<a href="https://tools.wmflabs.org/reasonator/?&q=' + wikidata.id + '&lang=nb">Reasonator</a>)');
          } else {
            element.html('<em>Record not connected to Wikidata</em>');
          }
        }
      })
    }
  }
})

.service('WikidataService', ['$http', '$q', function($http, $q) {

  this.fromBibsysId = function(id) {
    var deferred = $q.defer();

    var data = { id: null };

    function queryWdq() {
    console.log('Query WDQ');
      $http({
        url: 'https://wdq.wmflabs.org/api',
        method: 'JSONP',
        params: {
          q: 'string[1015:"' + id + '"]',
          callback: 'JSON_CALLBACK'
        }
      })
      .error(function(response, status, headers, config) {
        deferred.reject(status);
      })
      .success(function(response) {

        if (response.items.length == 0) {
          deferred.resolve(data);
          return;
        }

        data.id = response.items[0];
        queryWd()
      });
    }

    function queryWd() {
      console.log('Query WD');
      $http({
        url: 'https://www.wikidata.org/w/api.php',
        method: 'JSONP',
        params: {
          action: 'wbgetentities',
          format: 'json',
          ids: 'Q' + data.id,
          props: 'info|sitelinks/urls|aliases|labels|descriptions|claims|datatype',
          callback: 'JSON_CALLBACK'
        }
      })
      .error(function(response, status, headers, config) {
        deferred.reject(status);
      })
      .success(function(response) {
        // TODO
        deferred.resolve(data);
      });
    }

    queryWdq();

    return deferred.promise;
  }

}])

.controller('RecordCtrl', ['$scope', '$http', '$routeParams', '$timeout', 'WikidataService', function($scope, $http, $routeParams, $timeout, WikidataService) {

  $scope.busy = true;
  $scope.authorityBusy = true;
  $scope.biblioBusy = false;
  $scope.viafBusy = true;
  $scope.wdBusy = true;

  var tasksLeft = 3;
  var nextRecordPosition = 1;
  $scope.id = $routeParams.id;

  function taskDone() {
    tasksLeft--;
    console.log('Task done, left: ' + tasksLeft);
    if (tasksLeft <= 0) $scope.busy = false;
  }
 
  // Query Bibsys
  $http.get('api.php?id=' + $scope.id)
   .success(function(response) {
    $scope.record = response.numberOfRecords ? response.records[0] : false;
    $scope.authorityBusy = false;
    taskDone();
   });

  // Query VIAF
  $http.get('api.php?viaf=' + $scope.id)
   .success(function(response) {
    $scope.viaf = response.numberOfRecords ? response.records[0] : false;
    $scope.viafBusy = false;
    taskDone();
   });

  // Query Wikidata
  WikidataService.fromBibsysId($scope.id).then(function(data) {
    console.log('WD promise done');
    $scope.wdBusy = false;
    $scope.wikidata = data;
    taskDone();
  }, function() {
    $scope.wdBusy = false;
    $scope.wikidata = null;
    taskDone();    
  });

  $scope.morePublications = function() {
    if (!nextRecordPosition || $scope.biblioBusy) {
      return;
    }
    console.log('Getting more bibliographic records, starting at ', nextRecordPosition);

    $scope.biblioBusy = true;
    $http.get('api.php?pub=' + $scope.id + '&start=' + nextRecordPosition)
     .success(function(response) {
      $scope.publications = $scope.publications.concat(response.records);
      nextRecordPosition = response.nextRecordPosition;
      $scope.biblioBusy = false;
     });
  };

  $scope.publications = [];

  // getBiblio();

  var startTime = (new Date()).getTime()/1000;

  function upTimer() {
    var t = (new Date()).getTime()/1000 - startTime;
    if ($scope.authorityBusy) $scope.authorityTimer = t;
    if ($scope.viafBusy) $scope.viafTimer = t;
    if ($scope.wdBusy) $scope.wdTimer = t;
    if ($scope.biblioBusy) $scope.biblioTimer = t;
    if (tasksLeft) $timeout(upTimer, 50);
  }

  $scope.authorityTimer = 0;
  $scope.biblioTimer = 0;
  $scope.viafTimer = 0;
  $scope.wdTimer = 0;
  upTimer();  
 
}]);

angular.module('infinite-scroll').value('THROTTLE_MILLISECONDS', 250);
