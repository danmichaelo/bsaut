'use strict';

// Declare app level module which depends on filters, and services
angular.module('app', ['ngRoute', 'infinite-scroll'])

.factory('preventTemplateCache', function() {
  /**
   * Quick and dirty fix to prevent template caching.
   * Ideally,
   * Source: https://medium.com/angularjs-tricks/prevent-annoying-template-caching-in-angularjs-1-x-b706bf9c4056
   */
  const build = Date.now().toString();  // Would be better to use git build here, but then we need to fetch that.
  return {
    'request': function(config) {
      console.log('CHECK', config.url)
      if (config.url.indexOf && config.url.indexOf('views') !== -1) {
        config.url = config.url + '?t=' + build;
      }
      return config;
    }
  }
})
.config(['$httpProvider', function($httpProvider) {
  $httpProvider.interceptors.push('preventTemplateCache');
}])

.config(function($routeProvider, $locationProvider) {

  $routeProvider
    .when('/', {
      templateUrl: 'views/index.html',
      controller : 'SearchResultsCtrl'
    })
    .when('/search/:query', {
      redirectTo: function(routeParams) {
        console.log(routeParams);
        return '/search?scope=everything&q=' + routeParams.query;
      }
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

.service('ScopesService', [function () {

  this.items = [
    {
      id: 'everything',
      label: 'Everything',
      viafSearchField: 'local.names',
    },
    {
      id: 'persons',
      label: 'Persons',
      viafSearchField: 'local.personalNames',
    },
    {
      id: 'corporations',
      label: 'Corporations',
      viafSearchField: 'local.corporateNames',
    },
    {
      id: 'meetings',
      label: 'Meetings',
      viafSearchField: 'local.names',
    },
  ];

  this.get = () => {
    return this.items;
  }

  this.find = (value) => {
    if (!value) {
      return this.items[0];
    }
    for (let idx = 0; idx < this.items.length; idx++) {
      if (this.items[idx].id == value) {
        return this.items[idx]
      }
    }
    return this.items[0];
  }

}])

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
      console.log(response.status)
      if (response.status != 200) {
        console.log('Search failed')
        $rootScope.$broadcast('searchFailed', response.data);
      } else {
        $rootScope.$broadcast('searchResults', response.data);
      }
      $rootScope.$broadcast('requestFinish');
     })
    .catch(function() {
      $rootScope.$broadcast('searchFailed');
      $rootScope.$broadcast('requestFinish');
     });
  };

}])

.controller('SearchResultsCtrl', ['$location', '$scope', '$routeParams', 'ApiService', 'ScopesService', function($location, $scope, $routeParams, ApiService, ScopesService) {
  console.log($routeParams);

  var nextRecordPosition = 1;
  $scope.busy = false;
  $scope.records = [];
  $scope.numberOfRecords = -1;
  $scope.query = $routeParams.q;
  $scope.queryEncoded = encodeURIComponent($routeParams.q);
  $scope.queryScope = $routeParams.scope;

  const selectedScope = ScopesService.find($location.search().scope);
  $scope.viafSearchField = selectedScope.viafSearchField;


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

  $scope.$on('searchFailed', function(e, results) {
    console.log('Search failed');
    $scope.records = [];
    $scope.error = 'Search failed';
  });

  $scope.moreRecords = function () {
    if ($scope.busy || ! nextRecordPosition || $scope.error) {
      return;
    }
    if ($scope.query) {
      console.log('Get more records from ', nextRecordPosition, 'scope: ', $scope.queryScope);
      $scope.error = null;
      ApiService.searchBibsys($scope.query, $scope.queryScope, nextRecordPosition);
    }
  };

}])

.controller('SearchFormCtrl', ['$scope', '$routeParams', '$location', 'ScopesService', function($scope, $routeParams, $location, ScopesService) {

  $scope.busy = false;
  $scope.query = $routeParams.query;
  $scope.query = '';
  $scope.scopes = ScopesService.get();

  $scope.selectedScope = ScopesService.find($location.search().scope);

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
            element.html('<i class="fa fa-check-circle text-success"></i> <a href="http://viaf.org/viaf/' + viaf.id + '/">' + viaf.id + '</a> ' + viaf.mainHeadings.reduce(function(prev, cur) { return (prev ? prev + ' | ' : '') + cur.title; }, null) );
          } else {
            element.html('<i class="fa fa-times text-muted"></i> <em>Not linked from VIAF</em>');
          }
        }
      })
    }
  }
})

.directive('isniLink', function () {
  return {
    // We limit this directive to attributes only
    restrict : 'A',

    // We will replace the original element code
    replace : true,

    // We must supply at least one element in the code to replace the div
    template : '<td></td>',

    link: function(scope, element, attrs) {
      scope.$watch('record', (record) => {
        if (record.other_ids.isni) {
          element.html('<i class="fa fa-check-circle text-success"></i> <a href="https://isni.org/isni/' + record.other_ids.isni + '">' + record.other_ids.isni.match(/.{1,4}/g).join(' ') + '</a>');
        } else {
          element.html('<i class="fa fa-times text-muted"></i> <em>Not linked to ISNI</em>');
        }
      })
    }
  }
})

.directive('bibbiLink', ['$http', function ($http) {
  return {
    // We limit this directive to attributes only
    restrict : 'A',

    // We will replace the original element code
    replace : true,

    // We must supply at least one element in the code to replace the div
    template : '<td></td>',

    link: function(scope, element, attrs) {
      scope.$watch('record', (record) => {
        if (record.other_ids.bibbi) {
          const bibbi_id = record.other_ids.bibbi ;
          const entity_uri = 'http://id.bibbi.dev/bibbi/' + bibbi_id ;

          console.log('Checking Bibbi: '+ bibbi_id);
          element.html(`<i class="fa fa-cog fa-spin"></i> <a href="${entity_uri}">${bibbi_id}</a>`);

          $http.get('api.php?bibbi=' + bibbi_id)
            .then(bibbi_res => {
              console.log('Bibbi response: ', bibbi_res.data['@graph']);
              const entity = bibbi_res.data['@graph'].find(entity => entity.uri == entity_uri)
              if (entity) {
                console.log(entity)
                element.html(`<i class="fa fa-check-circle text-success"></i> <a href="${entity_uri}">${bibbi_id}</a> ${entity.prefLabel.nb}`);
              } else {
                element.html(`<i class="fa fa-question-circle-o text-warning"></i> <a href="${entity_uri}">${bibbi_id}</a>: Failed to lookup`);
              }
            }).catch(err => {
              console.error('Bibbi failed', err)
              element.html(`<i class="fa fa-question-circle-o text-warning"></i> <a href="${entity_uri}">${bibbi_id}</a>: An error occured`);
            })

        } else {
          element.html('<i class="fa fa-times text-muted"></i> <em>Record not linked to Bibbi</em>');
        }
      })
    }
  }
}])

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
            let label = ''
            const languages = ['en']
            if (wikidata.labels[languages[0]]) {
              label += wikidata.labels[languages[0]].value
            }
            if (wikidata.descriptions[languages[0]]) {
              label += ' (' + wikidata.descriptions[languages[0]].value + ')'
            }
            if (wikidata.sitelinks['enwiki']) {
              label += ' | <a href="' + wikidata.sitelinks['enwiki'].url + '">Wikipedia (en)</a>'
            }
            if (wikidata.sitelinks['nbwiki']) {
              label += ' | <a href="' + wikidata.sitelinks['nbwiki'].url + '">Wikipedia (nb)</a>'
            }
            if (wikidata.sitelinks['nnwiki']) {
              label += ' | <a href="' + wikidata.sitelinks['nnwiki'].url + '">Wikipedia (nn)</a>'
            }
            if (wikidata.sitelinks['svwiki']) {
              label += ' | <a href="' + wikidata.sitelinks['svwiki'].url + '">Wikipedia (sv)</a>'
            }
            element.html('<i class="fa fa-check-circle text-success"></i> <a href="https://wikidata.org/wiki/' + wikidata.id + '">' + wikidata.id + '</a> (<a href="https://tools.wmflabs.org/reasonator/?&q=' + wikidata.id + '&lang=nb">Reasonator</a>) ' + label);
          } else {
            element.html('<i class="fa fa-times text-muted"></i> <em>Not linked from Wikidata</em>');
          }
        }
      })
    }
  }
})

.service('WikidataService', ['$http', '$q', '$sce', function($http, $q, $sce) {

  this.fromBibsysId = function(id) {
    var deferred = $q.defer();

    function queryWdq() {
      console.log('Query WDQ for',id);
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
          deferred.resolve({ id: null });
          return;
        }

        queryWd(response.data.items[0])
      });
    }

    function querySparql() {
      console.log('Query SPARQL for',id);
      $http({
        url: 'api.php',
        method: 'GET',
        params: {
          sparql: id
        }
      })
      .catch(response => {
        deferred.reject(response.status);
      })
      .then(response => {
        const items = response.data.items

        if (items.length == 0) {
          deferred.resolve({ id: null });
          console.log('No Wikidata element found');
          return;
        }

        queryWd('Q' + items[0].split('Q')[1])
      });
    }

    function queryWd(wikidataId) {
      console.log('Wikidata lookup: ' + wikidataId);
      $http({
        url: $sce.trustAsResourceUrl('https://www.wikidata.org/w/api.php'),
        method: 'JSONP',
        params: {
          action: 'wbgetentities',
          format: 'json',
          ids: wikidataId,
          props: 'info|sitelinks/urls|aliases|labels|descriptions|claims|datatype',
        },
        jsonpCallbackParam: 'callback',
      })
      .catch(response => {
        console.log('Wikidata request failed!', response)
        deferred.reject(response.status);
      })
      .then(response => {
        const entity = response.data.entities[wikidataId];
        console.log('Wikidata response: ', entity);
        deferred.resolve({
          id: wikidataId,
          labels: entity.labels,
          descriptions: entity.descriptions,
          sitelinks: entity.sitelinks,
          // TODO: Add more interesting stuff here
        });
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

  const roles = {
    'abr': {label: 'Abridger', adverb: 'of'},
    'acp': {label: 'Art copyist', adverb: 'of'},
    'act': {label: 'Actor', adverb: 'in'},
    'adi': {label: 'Art director', adverb: 'in'},
    'adp': {label: 'Adapter', adverb: 'of/in'},
    'aft': {label: 'Author of afterword, colophon, etc.', adverb: 'in'},
    'anl': {label: 'Analyst', adverb: 'of/in'},
    'anm': {label: 'Animator', adverb: 'of/in'},
    'ann': {label: 'Annotator', adverb: 'of/in'},
    'ant': {label: 'Bibliographic antecedent', adverb: 'of/in'},
    'ape': {label: 'Appellee', adverb: 'of/in'},
    'apl': {label: 'Appellant', adverb: 'of/in'},
    'app': {label: 'Applicant', adverb: 'of/in'},
    'aqt': {label: 'Author in quotations or text abstracts', adverb: 'of/in'},
    'arc': {label: 'Architect', adverb: 'of/in'},
    'ard': {label: 'Artistic director', adverb: 'of/in'},
    'arr': {label: 'Arranger', adverb: 'of/in'},
    'art': {label: 'Artist', adverb: 'of/in'},
    'asg': {label: 'Assignee', adverb: 'of/in'},
    'asn': {label: 'Associated name', adverb: 'of/in'},
    'ato': {label: 'Autographer', adverb: 'of/in'},
    'att': {label: 'Attributed name', adverb: 'of/in'},
    'auc': {label: 'Auctioneer', adverb: 'of/in'},
    'aud': {label: 'Author of dialog', adverb: 'of/in'},
    'aui': {label: 'Author of introduction, etc.', adverb: 'of/in'},
    'aus': {label: 'Screenwriter', adverb: 'of/in'},
    'aut': {label: 'Author', adverb: 'of'},
    'bdd': {label: 'Binding designer', adverb: 'of/in'},
    'bjd': {label: 'Bookjacket designer', adverb: 'of/in'},
    'bkd': {label: 'Book designer', adverb: 'of/in'},
    'bkp': {label: 'Book producer', adverb: 'of/in'},
    'blw': {label: 'Blurb writer', adverb: 'of/in'},
    'bnd': {label: 'Binder', adverb: 'of/in'},
    'bpd': {label: 'Bookplate designer', adverb: 'of/in'},
    'brd': {label: 'Broadcaster', adverb: 'of/in'},
    'brl': {label: 'Braille embosser', adverb: 'of/in'},
    'bsl': {label: 'Bookseller', adverb: 'of/in'},
    'cas': {label: 'Caster', adverb: 'of/in'},
    'ccp': {label: 'Conceptor', adverb: 'of/in'},
    'chr': {label: 'Choreographer', adverb: 'of/in'},
    'clb': {label: 'Collaborator', adverb: 'of/in'},
    'cli': {label: 'Client', adverb: 'of/in'},
    'cll': {label: 'Calligrapher', adverb: 'of/in'},
    'clr': {label: 'Colorist', adverb: 'of/in'},
    'clt': {label: 'Collotyper', adverb: 'of/in'},
    'cmm': {label: 'Commentator', adverb: 'of/in'},
    'cmp': {label: 'Composer', adverb: 'of/in'},
    'cmt': {label: 'Compositor', adverb: 'of/in'},
    'cnd': {label: 'Conductor', adverb: 'of/in'},
    'cng': {label: 'Cinematographer', adverb: 'of/in'},
    'cns': {label: 'Censor', adverb: 'of/in'},
    'coe': {label: 'Contestant-appellee', adverb: 'of/in'},
    'col': {label: 'Collector', adverb: 'of/in'},
    'com': {label: 'Compiler', adverb: 'of/in'},
    'con': {label: 'Conservator', adverb: 'of/in'},
    'cor': {label: 'Collection registrar', adverb: 'of/in'},
    'cos': {label: 'Contestant', adverb: 'of/in'},
    'cot': {label: 'Contestant-appellant', adverb: 'of/in'},
    'cou': {label: 'Court governed', adverb: 'of/in'},
    'cov': {label: 'Cover designer', adverb: 'of/in'},
    'cpc': {label: 'Copyright claimant', adverb: 'of/in'},
    'cpe': {label: 'Complainant-appellee', adverb: 'of/in'},
    'cph': {label: 'Copyright holder', adverb: 'of/in'},
    'cpl': {label: 'Complainant', adverb: 'of/in'},
    'cpt': {label: 'Complainant-appellant', adverb: 'of/in'},
    'cre': {label: 'Creator', adverb: 'of'},
    'crp': {label: 'Correspondent', adverb: 'of/in'},
    'crr': {label: 'Corrector', adverb: 'of/in'},
    'crt': {label: 'Court reporter', adverb: 'of/in'},
    'csl': {label: 'Consultant', adverb: 'of/in'},
    'csp': {label: 'Consultant to a project', adverb: 'of/in'},
    'cst': {label: 'Costume designer', adverb: 'of/in'},
    'ctb': {label: 'Contributor', adverb: 'of/in'},
    'cte': {label: 'Contestee-appellee', adverb: 'of/in'},
    'ctg': {label: 'Cartographer', adverb: 'of/in'},
    'ctr': {label: 'Contractor', adverb: 'of/in'},
    'cts': {label: 'Contestee', adverb: 'of/in'},
    'ctt': {label: 'Contestee-appellant', adverb: 'of/in'},
    'cur': {label: 'Curator', adverb: 'of/in'},
    'cwt': {label: 'Commentator for written text', adverb: 'of/in'},
    'dbp': {label: 'Distribution place', adverb: 'of/in'},
    'dfd': {label: 'Defendant', adverb: 'of/in'},
    'dfe': {label: 'Defendant-appellee', adverb: 'of/in'},
    'dft': {label: 'Defendant-appellant', adverb: 'of/in'},
    'dgg': {label: 'Degree granting institution', adverb: 'for'},
    'dgs': {label: 'Degree supervisor', adverb: 'for'},
    'dis': {label: 'Dissertant', adverb: 'for'},
    'dln': {label: 'Delineator', adverb: 'of/in'},
    'dnc': {label: 'Dancer', adverb: 'of/in'},
    'dnr': {label: 'Donor', adverb: 'of/in'},
    'dpc': {label: 'Depicted', adverb: 'of/in'},
    'dpt': {label: 'Depositor', adverb: 'of/in'},
    'drm': {label: 'Draftsman', adverb: 'of/in'},
    'drt': {label: 'Director', adverb: 'of/in'},
    'dsr': {label: 'Designer', adverb: 'of/in'},
    'dst': {label: 'Distributor', adverb: 'of/in'},
    'dtc': {label: 'Data contributor', adverb: 'of/in'},
    'dte': {label: 'Dedicatee', adverb: 'of/in'},
    'dtm': {label: 'Data manager', adverb: 'of/in'},
    'dto': {label: 'Dedicator', adverb: 'of/in'},
    'dub': {label: 'Dubious author', adverb: 'of/in'},
    'edc': {label: 'Editor of compilation', adverb: 'of/in'},
    'edm': {label: 'Editor of moving image work', adverb: 'of/in'},
    'edt': {label: 'Editor', adverb: 'of/in'},
    'egr': {label: 'Engraver', adverb: 'of/in'},
    'elg': {label: 'Electrician', adverb: 'of/in'},
    'elt': {label: 'Electrotyper', adverb: 'of/in'},
    'eng': {label: 'Engineer', adverb: 'of/in'},
    'enj': {label: 'Enacting jurisdiction', adverb: 'of/in'},
    'etr': {label: 'Etcher', adverb: 'of/in'},
    'evp': {label: 'Event place', adverb: 'of/in'},
    'exp': {label: 'Expert', adverb: 'of/in'},
    'fac': {label: 'Facsimilist', adverb: 'of/in'},
    'fds': {label: 'Film distributor', adverb: 'of/in'},
    'fld': {label: 'Field director', adverb: 'of/in'},
    'flm': {label: 'Film editor', adverb: 'of/in'},
    'fmd': {label: 'Film director', adverb: 'of/in'},
    'fmk': {label: 'Filmmaker', adverb: 'of/in'},
    'fmo': {label: 'Former owner', adverb: 'of/in'},
    'fmp': {label: 'Film producer', adverb: 'of/in'},
    'fnd': {label: 'Funder', adverb: 'of/in'},
    'fpy': {label: 'First party', adverb: 'of/in'},
    'frg': {label: 'Forger', adverb: 'of/in'},
    'gis': {label: 'Geographic information specialist', adverb: 'of/in'},
    'grt': {label: 'Graphic technician', adverb: 'of/in'},
    'his': {label: 'Host institution', adverb: 'of/in'},
    'hnr': {label: 'Honoree', adverb: 'of/in'},
    'hst': {label: 'Host', adverb: 'of/in'},
    'ill': {label: 'Illustrator', adverb: 'of'},
    'ilu': {label: 'Illuminator', adverb: 'of/in'},
    'ins': {label: 'Inscriber', adverb: 'of/in'},
    'inv': {label: 'Inventor', adverb: 'of/in'},
    'isb': {label: 'Issuing body', adverb: 'of/in'},
    'itr': {label: 'Instrumentalist', adverb: 'of/in'},
    'ive': {label: 'Interviewee', adverb: 'of/in'},
    'ivr': {label: 'Interviewer', adverb: 'of/in'},
    'jud': {label: 'Judge', adverb: 'of/in'},
    'jug': {label: 'Jurisdiction governed', adverb: 'of/in'},
    'lbr': {label: 'Laboratory', adverb: 'of/in'},
    'lbt': {label: 'Librettist', adverb: 'of/in'},
    'ldr': {label: 'Laboratory director', adverb: 'of/in'},
    'led': {label: 'Lead', adverb: 'of/in'},
    'lee': {label: 'Libelee-appellee', adverb: 'of/in'},
    'lel': {label: 'Libelee', adverb: 'of/in'},
    'len': {label: 'Lender', adverb: 'of/in'},
    'let': {label: 'Libelee-appellant', adverb: 'of/in'},
    'lgd': {label: 'Lighting designer', adverb: 'of/in'},
    'lie': {label: 'Libelant-appellee', adverb: 'of/in'},
    'lil': {label: 'Libelant', adverb: 'of/in'},
    'lit': {label: 'Libelant-appellant', adverb: 'of/in'},
    'lsa': {label: 'Landscape architect', adverb: 'of/in'},
    'lse': {label: 'Licensee', adverb: 'of/in'},
    'lso': {label: 'Licensor', adverb: 'of/in'},
    'ltg': {label: 'Lithographer', adverb: 'of/in'},
    'lyr': {label: 'Lyricist', adverb: 'of/in'},
    'mcp': {label: 'Music copyist', adverb: 'of/in'},
    'mdc': {label: 'Metadata contact', adverb: 'of/in'},
    'med': {label: 'Medium', adverb: 'of/in'},
    'mfp': {label: 'Manufacture place', adverb: 'of/in'},
    'mfr': {label: 'Manufacturer', adverb: 'of/in'},
    'mod': {label: 'Moderator', adverb: 'of/in'},
    'mon': {label: 'Monitor', adverb: 'of/in'},
    'mrb': {label: 'Marbler', adverb: 'of/in'},
    'mrk': {label: 'Markup editor', adverb: 'of/in'},
    'msd': {label: 'Musical director', adverb: 'of/in'},
    'mte': {label: 'Metal-engraver', adverb: 'of/in'},
    'mtk': {label: 'Minute taker', adverb: 'of/in'},
    'mus': {label: 'Musician', adverb: 'of/in'},
    'nrt': {label: 'Narrator', adverb: 'of/in'},
    'opn': {label: 'Opponent', adverb: 'of/in'},
    'org': {label: 'Originator', adverb: 'of/in'},
    'orm': {label: 'Organizer', adverb: 'of/in'},
    'osp': {label: 'Onscreen presenter', adverb: 'of/in'},
    'oth': {label: 'Other', adverb: 'of/in'},
    'own': {label: 'Owner', adverb: 'of/in'},
    'pan': {label: 'Panelist', adverb: 'of/in'},
    'pat': {label: 'Patron', adverb: 'of/in'},
    'pbd': {label: 'Publishing director', adverb: 'of/in'},
    'pbl': {label: 'Publisher', adverb: 'of/in'},
    'pdr': {label: 'Project director', adverb: 'of/in'},
    'pfr': {label: 'Proofreader', adverb: 'of/in'},
    'pht': {label: 'Photographer', adverb: 'of/in'},
    'plt': {label: 'Platemaker', adverb: 'of/in'},
    'pma': {label: 'Permitting agency', adverb: 'of/in'},
    'pmn': {label: 'Production manager', adverb: 'of/in'},
    'pop': {label: 'Printer of plates', adverb: 'of/in'},
    'ppm': {label: 'Papermaker', adverb: 'of/in'},
    'ppt': {label: 'Puppeteer', adverb: 'of/in'},
    'pra': {label: 'Praeses', adverb: 'of/in'},
    'prc': {label: 'Process contact', adverb: 'of/in'},
    'prd': {label: 'Production personnel', adverb: 'of/in'},
    'pre': {label: 'Presenter', adverb: 'of/in'},
    'prf': {label: 'Performer', adverb: 'of/in'},
    'prg': {label: 'Programmer', adverb: 'of/in'},
    'prm': {label: 'Printmaker', adverb: 'of/in'},
    'prn': {label: 'Production company', adverb: 'for'},
    'pro': {label: 'Producer', adverb: 'of'},
    'prp': {label: 'Production place', adverb: 'of/in'},
    'prs': {label: 'Production designer', adverb: 'of/in'},
    'prt': {label: 'Printer', adverb: 'of/in'},
    'prv': {label: 'Provider', adverb: 'of/in'},
    'pta': {label: 'Patent applicant', adverb: 'of/in'},
    'pte': {label: 'Plaintiff-appellee', adverb: 'of/in'},
    'ptf': {label: 'Plaintiff', adverb: 'of/in'},
    'pth': {label: 'Patent holder', adverb: 'of/in'},
    'ptt': {label: 'Plaintiff-appellant', adverb: 'of/in'},
    'pup': {label: 'Publication place', adverb: 'of/in'},
    'rbr': {label: 'Rubricator', adverb: 'of/in'},
    'rcd': {label: 'Recordist', adverb: 'of/in'},
    'rce': {label: 'Recording engineer', adverb: 'of/in'},
    'rcp': {label: 'Addressee', adverb: 'of/in'},
    'rdd': {label: 'Radio director', adverb: 'of/in'},
    'red': {label: 'Redaktor', adverb: 'of/in'},
    'ren': {label: 'Renderer', adverb: 'of/in'},
    'res': {label: 'Researcher', adverb: 'of/in'},
    'rev': {label: 'Reviewer', adverb: 'of/in'},
    'rpc': {label: 'Radio producer', adverb: 'of/in'},
    'rps': {label: 'Repository', adverb: 'of/in'},
    'rpt': {label: 'Reporter', adverb: 'of/in'},
    'rpy': {label: 'Responsible party', adverb: 'of/in'},
    'rse': {label: 'Respondent-appellee', adverb: 'of/in'},
    'rsg': {label: 'Restager', adverb: 'of/in'},
    'rsp': {label: 'Respondent', adverb: 'of/in'},
    'rsr': {label: 'Restorationist', adverb: 'of/in'},
    'rst': {label: 'Respondent-appellant', adverb: 'of/in'},
    'rth': {label: 'Research team head', adverb: 'of/in'},
    'rtm': {label: 'Research team member', adverb: 'of/in'},
    'sad': {label: 'Scientific advisor', adverb: 'of/in'},
    'sce': {label: 'Scenarist', adverb: 'of/in'},
    'scl': {label: 'Sculptor', adverb: 'of/in'},
    'scr': {label: 'Scribe', adverb: 'of/in'},
    'sds': {label: 'Sound designer', adverb: 'of/in'},
    'sec': {label: 'Secretary', adverb: 'of/in'},
    'sgd': {label: 'Stage director', adverb: 'of/in'},
    'sgn': {label: 'Signer', adverb: 'of/in'},
    'sht': {label: 'Supporting host', adverb: 'of/in'},
    'sll': {label: 'Seller', adverb: 'of/in'},
    'sng': {label: 'Singer', adverb: 'of/in'},
    'spk': {label: 'Speaker', adverb: 'of/in'},
    'spn': {label: 'Sponsor', adverb: 'of/in'},
    'spy': {label: 'Second party', adverb: 'of/in'},
    'srv': {label: 'Surveyor', adverb: 'of/in'},
    'std': {label: 'Set designer', adverb: 'of/in'},
    'stg': {label: 'Setting', adverb: 'of/in'},
    'stl': {label: 'Storyteller', adverb: 'of/in'},
    'stm': {label: 'Stage manager', adverb: 'of/in'},
    'stn': {label: 'Standards body', adverb: 'of/in'},
    'str': {label: 'Stereotyper', adverb: 'of/in'},
    'tcd': {label: 'Technical director', adverb: 'of/in'},
    'tch': {label: 'Teacher', adverb: 'of/in'},
    'ths': {label: 'Thesis advisor', adverb: 'of/in'},
    'tld': {label: 'Television director', adverb: 'of/in'},
    'tlp': {label: 'Television producer', adverb: 'of/in'},
    'trc': {label: 'Transcriber', adverb: 'of/in'},
    'trl': {label: 'Translator', adverb: 'of/in'},
    'tyd': {label: 'Type designer', adverb: 'of/in'},
    'tyg': {label: 'Typographer', adverb: 'of/in'},
    'uvp': {label: 'University place', adverb: 'of/in'},
    'vac': {label: 'Voice actor', adverb: 'of/in'},
    'vdg': {label: 'Videographer', adverb: 'of/in'},
    'voc': {label: 'Vocalist', adverb: 'of/in'},
    'wac': {label: 'Writer of added commentary', adverb: 'of/in'},
    'wal': {label: 'Writer of added lyrics', adverb: 'of/in'},
    'wam': {label: 'Writer of accompanying material', adverb: 'of/in'},
    'wat': {label: 'Writer of added text', adverb: 'of/in'},
    'wdc': {label: 'Woodcutter', adverb: 'of/in'},
    'wde': {label: 'Wood engraver', adverb: 'of/in'},
    'win': {label: 'Writer of introduction', adverb: 'of/in'},
    'wit': {label: 'Witness', adverb: 'of/in'},
    'wpr': {label: 'Writer of preface', adverb: 'of/in'},
    'wst': {label: 'Writer of supplementary textual content', adverb: 'of/in'},
  }

  function roleFromRelationship(code) {
    return roles[code];
  }

  // Query Bibsys
  $http.get('api.php?id=' + $scope.id)
    .then(function(response) {
      let record = response.data.numberOfRecords ? response.data.records[0] : false;
      if (record && record.altLabels) {
        record.altLabels = record.altLabels.filter(function (value, index, self) {
          // Only unique
          return self.indexOf(value) === index;
        })
      }
      $scope.record = record;
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
        const records = response.data.records.map(record => {

          record.creators = record.creators.map(creator => {
            if (creator.relationship) {
              creator.role = roleFromRelationship(creator.relationship)
            }
            return creator
          })

          record.matched_creator = (record.creators === undefined)
              ? null
              : record.creators.find(el => el.id.replace('(NO-TrBIB)', '') == $scope.id)
          return record
        })
        $scope.publications = $scope.publications.concat(records);
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
