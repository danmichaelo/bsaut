'use strict';

// Declare app level module which depends on filters, and services
angular.module('app', ['ngRoute', 'infinite-scroll'])

.config(function($routeProvider, $locationProvider) {

  $routeProvider
    .when('/', {
      templateUrl: 'views/index.html',
      controller : 'SearchResultsCtrl'
    })
    .when('/search', {
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

  this.searchBibsys = function(query, queryScope, startPos) {

    // TODO: queryScope

    if (that.canceler) {
      console.log('Aborting');
      that.canceler.resolve();
    }

    that.canceler = $q.defer();

    $rootScope.$broadcast('requestStart');
    $rootScope.$broadcast('searchStart', query);
    $http({
      method: 'GET',
      url: 'api.php?q=' + query + '&start=' + startPos + '&scope=' + queryScope,
      timeout: that.canceler
    })
    .then(function(response) {
      $rootScope.$broadcast('searchResults', response.data);
      $rootScope.$broadcast('requestFinish');
     })
    .catch(function() {
      $rootScope.$broadcast('requestFinish');
     });
  };

}])

.controller('SearchResultsCtrl', ['$scope', '$routeParams', 'ApiService', function($scope, $routeParams, ApiService) {
  console.log($routeParams);

  var nextRecordPosition = 1;
  $scope.busy = false;
  $scope.records = [];
  $scope.numberOfRecords = -1;
  $scope.query = $routeParams.q;
  $scope.queryScope = $routeParams.scope;

  $scope.$on('requestStart', function() {
    $scope.busy = true;
  });

  $scope.$on('requestFinish', function() {
    $scope.busy = false;
  });

  $scope.$on('searchResults', function(e, results) {
    $scope.records = $scope.records.concat(results.records);
    $scope.numberOfRecords = results.numberOfRecords;
    nextRecordPosition = results.nextRecordPosition;
    console.log('Got ', results.records.length, ' recs in this batch, total: ', $scope.records.length, 'recs');
  });

  $scope.moreRecords = function () {
    if ($scope.busy || ! nextRecordPosition) {
      return;
    }
    if ($scope.query) {
      console.log('Get more records from ', nextRecordPosition, 'scope: ', $scope.queryScope);
      ApiService.searchBibsys($scope.query, $scope.queryScope, nextRecordPosition);
    }
  };

}])

.controller('SearchFormCtrl', ['$scope', '$routeParams', '$location', function($scope, $routeParams, $location, ApiService) {

  $scope.busy = false;
  $scope.query = $routeParams.query;
  $scope.query = '';
  $scope.scopes = [
    {
      id: 'everything',
      label: 'Everything',
    },
    {
      id: 'persons',
      label: 'Persons',
    },
    {
      id: 'corporations',
      label: 'Corporations',
    },
    {
      id: 'conferences',
      label: 'Conferences',
    },
  ];
  $scope.selectedScope = $scope.scopes[0];
  console.log($location.search().scope)
  if ($location.search().scope) {
    $scope.scopes.forEach(c => {
      console.log(c, $location.search().scope)
      if (c.id == $location.search().scope) $scope.selectedScope = c;
    })
  }

  $scope.submit = function() {
    $location
      .path('/search')
      .search('scope', $scope.selectedScope.id)
      .search('q', $scope.query);
  };

  $scope.$on('searchStart', function(e, query) {
    console.log('Search start', query);
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
      .catch(function(response) {
        deferred.reject(response.status);
      })
      .then(function(response) {

        if (response.data.items.length == 0) {
          deferred.resolve(data);
          return;
        }

        data.id = response.data.items[0];
        queryWd()
      });
    }

    function querySparql() {
    console.log('Query SPARQL');
      $http({
        url: 'api.php',
        method: 'GET',
        params: {
          sparql: id
        }
      })
      .catch(function(response) {
        deferred.reject(response.status);
      })
      .then(function(response) {

        if (response.data.items.length == 0) {
          deferred.resolve(data);
          return;
        }
        data.id = response.data.items[0].split('Q')[1];
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
      .catch(function(response) {
        deferred.reject(response.status);
      })
      .then(function(response) {
        // TODO
        deferred.resolve(data);
      });
    }

    querySparql();

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
    .then(function(response) {
      $scope.record = response.data.numberOfRecords ? response.data.records[0] : false;
      $scope.authorityBusy = false;
      taskDone();
    });

  // Query VIAF
  $http.get('api.php?viaf=' + $scope.id)
    .then(function(response) {
      $scope.viaf = response.data.numberOfRecords ? response.data.records[0] : false;
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
      .then(function(response) {
        $scope.publications = $scope.publications.concat(response.data.records);
        nextRecordPosition = response.data.nextRecordPosition;
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
