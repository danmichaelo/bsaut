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
      if (config.url.indexOf('views') !== -1) {
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
            element.html('<a href="http://viaf.org/viaf/' + viaf.id + '/">' + viaf.id + '</a> : ' + viaf.mainHeadings.reduce(function(prev, cur) { return (prev ? prev + ' | ' : '') + cur.title; }, null) );
          } else {
            element.html('<em>Record not linked from VIAF</em>');
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
          element.html('<a href="https://isni.org/isni/' + record.other_ids.isni + '">' + record.other_ids.isni.match(/.{1,4}/g).join(' ') + '</a>');
        } else {
          element.html('<em>Record not linked to ISNI</em>');
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
            element.html('<a href="https://wikidata.org/wiki/' + wikidata.id + '">' + wikidata.id + '</a> (<a href="https://tools.wmflabs.org/reasonator/?&q=' + wikidata.id + '&lang=nb">Reasonator</a>)');
          } else {
            element.html('<em>Record not linked from Wikidata</em>');
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
          deferred.resolve({ id: null });
          return;
        }

        queryWd(response.data.items[0])
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
        console.log('Wikidata response: ', response);
        deferred.resolve({
          id: wikidataId,
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
    'abr': 'Abridger',
    'acp': 'Art copyist',
    'act': 'Actor',
    'adi': 'Art director',
    'adp': 'Adapter',
    'aft': 'Author of afterword, colophon, etc.',
    'anl': 'Analyst',
    'anm': 'Animator',
    'ann': 'Annotator',
    'ant': 'Bibliographic antecedent',
    'ape': 'Appellee',
    'apl': 'Appellant',
    'app': 'Applicant',
    'aqt': 'Author in quotations or text abstracts',
    'arc': 'Architect',
    'ard': 'Artistic director',
    'arr': 'Arranger',
    'art': 'Artist',
    'asg': 'Assignee',
    'asn': 'Associated name',
    'ato': 'Autographer',
    'att': 'Attributed name',
    'auc': 'Auctioneer',
    'aud': 'Author of dialog',
    'aui': 'Author of introduction, etc.',
    'aus': 'Screenwriter',
    'aut': 'Author',
    'bdd': 'Binding designer',
    'bjd': 'Bookjacket designer',
    'bkd': 'Book designer',
    'bkp': 'Book producer',
    'blw': 'Blurb writer',
    'bnd': 'Binder',
    'bpd': 'Bookplate designer',
    'brd': 'Broadcaster',
    'brl': 'Braille embosser',
    'bsl': 'Bookseller',
    'cas': 'Caster',
    'ccp': 'Conceptor',
    'chr': 'Choreographer',
    'clb': 'Collaborator',
    'cli': 'Client',
    'cll': 'Calligrapher',
    'clr': 'Colorist',
    'clt': 'Collotyper',
    'cmm': 'Commentator',
    'cmp': 'Composer',
    'cmt': 'Compositor',
    'cnd': 'Conductor',
    'cng': 'Cinematographer',
    'cns': 'Censor',
    'coe': 'Contestant-appellee',
    'col': 'Collector',
    'com': 'Compiler',
    'con': 'Conservator',
    'cor': 'Collection registrar',
    'cos': 'Contestant',
    'cot': 'Contestant-appellant',
    'cou': 'Court governed',
    'cov': 'Cover designer',
    'cpc': 'Copyright claimant',
    'cpe': 'Complainant-appellee',
    'cph': 'Copyright holder',
    'cpl': 'Complainant',
    'cpt': 'Complainant-appellant',
    'cre': 'Creator',
    'crp': 'Correspondent',
    'crr': 'Corrector',
    'crt': 'Court reporter',
    'csl': 'Consultant',
    'csp': 'Consultant to a project',
    'cst': 'Costume designer',
    'ctb': 'Contributor',
    'cte': 'Contestee-appellee',
    'ctg': 'Cartographer',
    'ctr': 'Contractor',
    'cts': 'Contestee',
    'ctt': 'Contestee-appellant',
    'cur': 'Curator',
    'cwt': 'Commentator for written text',
    'dbp': 'Distribution place',
    'dfd': 'Defendant',
    'dfe': 'Defendant-appellee',
    'dft': 'Defendant-appellant',
    'dgg': 'Degree granting institution',
    'dgs': 'Degree supervisor',
    'dis': 'Dissertant',
    'dln': 'Delineator',
    'dnc': 'Dancer',
    'dnr': 'Donor',
    'dpc': 'Depicted',
    'dpt': 'Depositor',
    'drm': 'Draftsman',
    'drt': 'Director',
    'dsr': 'Designer',
    'dst': 'Distributor',
    'dtc': 'Data contributor',
    'dte': 'Dedicatee',
    'dtm': 'Data manager',
    'dto': 'Dedicator',
    'dub': 'Dubious author',
    'edc': 'Editor of compilation',
    'edm': 'Editor of moving image work',
    'edt': 'Editor',
    'egr': 'Engraver',
    'elg': 'Electrician',
    'elt': 'Electrotyper',
    'eng': 'Engineer',
    'enj': 'Enacting jurisdiction',
    'etr': 'Etcher',
    'evp': 'Event place',
    'exp': 'Expert',
    'fac': 'Facsimilist',
    'fds': 'Film distributor',
    'fld': 'Field director',
    'flm': 'Film editor',
    'fmd': 'Film director',
    'fmk': 'Filmmaker',
    'fmo': 'Former owner',
    'fmp': 'Film producer',
    'fnd': 'Funder',
    'fpy': 'First party',
    'frg': 'Forger',
    'gis': 'Geographic information specialist',
    'grt': 'Graphic technician',
    'his': 'Host institution',
    'hnr': 'Honoree',
    'hst': 'Host',
    'ill': 'Illustrator',
    'ilu': 'Illuminator',
    'ins': 'Inscriber',
    'inv': 'Inventor',
    'isb': 'Issuing body',
    'itr': 'Instrumentalist',
    'ive': 'Interviewee',
    'ivr': 'Interviewer',
    'jud': 'Judge',
    'jug': 'Jurisdiction governed',
    'lbr': 'Laboratory',
    'lbt': 'Librettist',
    'ldr': 'Laboratory director',
    'led': 'Lead',
    'lee': 'Libelee-appellee',
    'lel': 'Libelee',
    'len': 'Lender',
    'let': 'Libelee-appellant',
    'lgd': 'Lighting designer',
    'lie': 'Libelant-appellee',
    'lil': 'Libelant',
    'lit': 'Libelant-appellant',
    'lsa': 'Landscape architect',
    'lse': 'Licensee',
    'lso': 'Licensor',
    'ltg': 'Lithographer',
    'lyr': 'Lyricist',
    'mcp': 'Music copyist',
    'mdc': 'Metadata contact',
    'med': 'Medium',
    'mfp': 'Manufacture place',
    'mfr': 'Manufacturer',
    'mod': 'Moderator',
    'mon': 'Monitor',
    'mrb': 'Marbler',
    'mrk': 'Markup editor',
    'msd': 'Musical director',
    'mte': 'Metal-engraver',
    'mtk': 'Minute taker',
    'mus': 'Musician',
    'nrt': 'Narrator',
    'opn': 'Opponent',
    'org': 'Originator',
    'orm': 'Organizer',
    'osp': 'Onscreen presenter',
    'oth': 'Other',
    'own': 'Owner',
    'pan': 'Panelist',
    'pat': 'Patron',
    'pbd': 'Publishing director',
    'pbl': 'Publisher',
    'pdr': 'Project director',
    'pfr': 'Proofreader',
    'pht': 'Photographer',
    'plt': 'Platemaker',
    'pma': 'Permitting agency',
    'pmn': 'Production manager',
    'pop': 'Printer of plates',
    'ppm': 'Papermaker',
    'ppt': 'Puppeteer',
    'pra': 'Praeses',
    'prc': 'Process contact',
    'prd': 'Production personnel',
    'pre': 'Presenter',
    'prf': 'Performer',
    'prg': 'Programmer',
    'prm': 'Printmaker',
    'prn': 'Production company',
    'pro': 'Producer',
    'prp': 'Production place',
    'prs': 'Production designer',
    'prt': 'Printer',
    'prv': 'Provider',
    'pta': 'Patent applicant',
    'pte': 'Plaintiff-appellee',
    'ptf': 'Plaintiff',
    'pth': 'Patent holder',
    'ptt': 'Plaintiff-appellant',
    'pup': 'Publication place',
    'rbr': 'Rubricator',
    'rcd': 'Recordist',
    'rce': 'Recording engineer',
    'rcp': 'Addressee',
    'rdd': 'Radio director',
    'red': 'Redaktor',
    'ren': 'Renderer',
    'res': 'Researcher',
    'rev': 'Reviewer',
    'rpc': 'Radio producer',
    'rps': 'Repository',
    'rpt': 'Reporter',
    'rpy': 'Responsible party',
    'rse': 'Respondent-appellee',
    'rsg': 'Restager',
    'rsp': 'Respondent',
    'rsr': 'Restorationist',
    'rst': 'Respondent-appellant',
    'rth': 'Research team head',
    'rtm': 'Research team member',
    'sad': 'Scientific advisor',
    'sce': 'Scenarist',
    'scl': 'Sculptor',
    'scr': 'Scribe',
    'sds': 'Sound designer',
    'sec': 'Secretary',
    'sgd': 'Stage director',
    'sgn': 'Signer',
    'sht': 'Supporting host',
    'sll': 'Seller',
    'sng': 'Singer',
    'spk': 'Speaker',
    'spn': 'Sponsor',
    'spy': 'Second party',
    'srv': 'Surveyor',
    'std': 'Set designer',
    'stg': 'Setting',
    'stl': 'Storyteller',
    'stm': 'Stage manager',
    'stn': 'Standards body',
    'str': 'Stereotyper',
    'tcd': 'Technical director',
    'tch': 'Teacher',
    'ths': 'Thesis advisor',
    'tld': 'Television director',
    'tlp': 'Television producer',
    'trc': 'Transcriber',
    'trl': 'Translator',
    'tyd': 'Type designer',
    'tyg': 'Typographer',
    'uvp': 'University place',
    'vac': 'Voice actor',
    'vdg': 'Videographer',
    'voc': 'Vocalist',
    'wac': 'Writer of added commentary',
    'wal': 'Writer of added lyrics',
    'wam': 'Writer of accompanying material',
    'wat': 'Writer of added text',
    'wdc': 'Woodcutter',
    'wde': 'Wood engraver',
    'win': 'Writer of introduction',
    'wit': 'Witness',
    'wpr': 'Writer of preface',
    'wst': 'Writer of supplementary textual content',
  }

  function roleFromRelationship(code) {
    return roles[code] + ' of/in';
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
