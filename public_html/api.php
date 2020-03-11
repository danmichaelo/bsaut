<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once('../vendor/autoload.php');
use Scriptotek\Sru\Client as SruClient;
use Scriptotek\SimpleMarcParser\AuthorityRecord;
use Scriptotek\SimpleMarcParser\BibliographicRecord;

class ViafParser
{
    function __construct($dom)
    {

        $out = array();
        $out['id'] = $dom->text('viaf:viafID');

        $out['titles'] = array_map(function($work) {
            return array(
                'count' => $work->attr('count'),
                'title' => $work->text('viaf:text'),
                'sources' => array_map(function($source) {
                    return $source->text();
                }, $work->xpath('viaf:sources/viaf:s'))
            );
        }, $dom->xpath('//viaf:titles/viaf:data'));

        $out['mainHeadings'] = array_map(function($heading) {
            return array(
                'title' => $heading->text('viaf:text'),
                'sources' => array_map(function($source) {
                    return $source->text();
                }, $heading->xpath('viaf:sources/viaf:s'))
            );
        }, $dom->xpath('//viaf:mainHeadings/viaf:data'));

        $this->data = $out;
    }

    public function toArray() {
        return $this->data;
    }
}

if (isset($_GET['origin'])) {
    header('Access-Control-Allow-Origin: *');
}
header('Content-type: application/json; charset=utf-8');

$extras = array();

$start = isset($_GET['start'])
    ? intval($_GET['start'])
    : 1;

$sru_version = '1.1';

// Lookup by id
if (isset($_GET['id'])) {
    $p = 'Scriptotek\SimpleMarcParser\AuthorityRecord';
    $url = 'https://authority.bibsys.no/authority/rest/sru';
    $schema = 'marcxchange';
    $query = 'rec.identifier="' . $_GET['id'] . '"';
    $limit = 1;

// Search by query
} else if (isset($_GET['q'])) {
    $p = 'Scriptotek\SimpleMarcParser\AuthorityRecord';
    $url = 'https://authority.bibsys.no/authority/rest/sru';
    $schema = 'marcxchange';
    $q = $_GET['q'];

    $scope = isset($_GET['scope']) ? $_GET['scope'] : 'everything';
    $validScopes = [
        'everything' => 'cql.allIndexes',
        'persons' => 'bib.namePersonal',
        'corporations' => 'bib.nameCorporate',
        'conferences' => 'bib.nameConference',
    ];
    $scope = isset($validScopes[$scope]) ? $validScopes[$scope] : 'cql.allIndexes';

    $m = preg_match('/^([^,]+) ([^, ]+)$/', $q, $matches);
    if ($m) {
        $q = $matches[2] . ', ' . $matches[1];
    }
    $m = preg_match('/^[0-9]+$/', $q);
    if ($m) {
        $query = 'rec.identifier="' . $q . '"';
    } else {
        $query = $scope . '="' . $q . '*"';
    }

    $limit = 25;

// Lookup publications by id
} else if (isset($_GET['pub'])) {
    $p = 'Scriptotek\SimpleMarcParser\BibliographicRecord';
    $schema = 'marcxml';
    $sru_version = '1.2';
    $url = 'https://bibsys-network.alma.exlibrisgroup.com/view/sru/47BIBSYS_NETWORK';
    $query = 'alma.authority_id="(NO-TrBIB)' . $_GET['pub'] . '"';
    $limit = 25;

// Lookup VIAF
} else if (isset($_GET['viaf'])) {
    $p = 'ViafParser';
    $url = 'http://viaf.org/viaf/search';
    $schema = 'default'; // VIAF-XML
    $query = 'local.source="bibsys|' . $_GET['viaf'] . '"';
    $limit = 1;
    $extras = array('httpAccept' => 'application/xml');

// WDQ
} else if (isset($_GET['wdq'])) {

    $q = array(
        'q' => 'string[1015:"' . $_GET['wdq'] . '"]'
    );
    $res = Requests::get('http://wdq.wmflabs.org/api?' . http_build_query($q));
    $out = json_decode($res->body);
    header('Content-type: application/json; charset=utf-8');
    if (version_compare(PHP_VERSION, '5.4.0') >= 0) {
        echo json_encode($out, JSON_PRETTY_PRINT);
    } else {
        echo json_encode($out);
    }
    exit;

// SPARQL
} else if (isset($_GET['sparql'])) {

    $q = ['query' => "
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        SELECT ?q WHERE { ?q wdt:P1015 \"" . $_GET['sparql'] . "\" . }
        "];
    $headers = array('Accept' => 'application/json');
    $res = Requests::get('https://query.wikidata.org/bigdata/namespace/wdq/sparql?' . http_build_query($q), $headers);
    $res = json_decode($res->body);
    $bindings = $res->results->bindings;
    header('Content-type: application/json; charset=utf-8');
    if (count($bindings) == 0) {
        echo json_encode(['items' => []]);
    } else {
        echo json_encode(['items' => [$bindings[0]->q->value]]);
    }
    exit;

// WD
} else if (isset($_GET['wd'])) {

    $q = array(
        'action' => 'wbgetentities',
        'format' => 'json',
        'ids' => $_GET['wd'],
        'props' => 'info|sitelinks/urls|aliases|labels|descriptions|claims|datatype',
    );
    $res = Requests::get('http://www.wikidata.org/w/api.php?' . http_build_query($q));
    $out = json_decode($res->body);
    header('Content-type: application/json; charset=utf-8');
    if (version_compare(PHP_VERSION, '5.4.0') >= 0) {
        echo json_encode($out, JSON_PRETTY_PRINT);
    } else {
        echo json_encode($out);
    }
    exit;

// Huh?
} else {
    die('no query given');
}

$client = new SruClient($url, array(
    'schema' => $schema,
    'version' => $sru_version,
    'user-agent' => 'BsAutSearch/0.1'
));

try {
    $response = $client->search($query, $start, $limit, $extras);
} catch (\GuzzleHttp\Exception\BadResponseException $ex) {
    http_response_code($ex->getResponse()->getStatusCode());
    echo json_encode([
        'error' => strval($ex),
        'status_code' => $ex->getResponse()->getStatusCode(),
    ], JSON_PRETTY_PRINT);
    exit;
}
$url = $client->urlTo($query, $start, $limit, $extras);
//if ($response->error) {
//    echo json_encode(array(
//        'url' => $url,
//        'error' => $response->error
//    ));
//    exit;
//}
$out = array(
    'url' => $url,
    'numberOfRecords' => $response->numberOfRecords,
    'records' => array(),
    'nextRecordPosition' => $response->nextRecordPosition,
);

foreach ($response->records as $record) {
    $record->data->registerXPathNamespace('marc', 'http://www.loc.gov/MARC21/slim');
    $record->data->registerXPathNamespace('viaf', 'http://viaf.org/viaf/terms#');

    // xpath union not supported for some reason
    $el = $record->data->first('marc:record') ?: $record->data->first('viaf:VIAFCluster');

    $x = new $p($el);
    $out['records'][] = $x->toArray();
}

if (version_compare(PHP_VERSION, '5.4.0') >= 0) {
    echo json_encode($out, JSON_PRETTY_PRINT);
} else {
    echo json_encode($out);
}
