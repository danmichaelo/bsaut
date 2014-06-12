<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once('vendor/autoload.php');
use Scriptotek\Sru\Client as SruClient;
use Scriptotek\SimpleMarcParser\AuthorityParser;
use Scriptotek\SimpleMarcParser\BibliographicParser;

class ViafParser
{
    
    function parse($dom)
    {
        $out = array();
        $out['id'] = $dom->text('ns2:viafID');

        $out['titles'] = array_map(function($work) {
            return array(
                'count' => $work->attr('count'),
                'title' => $work->text('ns2:text'),
                'sources' => array_map(function($source) {
                    return $source->text();
                }, $work->xpath('ns2:sources/ns2:s'))
            );
        }, $dom->xpath('//ns2:titles/ns2:data'));

        $out['mainHeadings'] = array_map(function($heading) {
            return array(
                'title' => $heading->text('ns2:text'),
                'sources' => array_map(function($source) {
                    return $source->text();
                }, $heading->xpath('ns2:sources/ns2:s'))
            );
        }, $dom->xpath('//ns2:mainHeadings/ns2:data'));

        return $out;
    }
}

$extras = array();

$start = isset($_GET['start'])
    ? intval($_GET['start'])
    : 1;

// Lookup by id
if (isset($_GET['id'])) {
    $p = new AuthorityParser;
    $url = 'http://sru.bibsys.no/search/authority';
    $schema = 'marcxchange';
    $query = 'rec.identifier="' . $_GET['id'] . '"';
    $limit = 1;

// Search by query
} else if (isset($_GET['q'])) {
    $p = new AuthorityParser;
    $url = 'http://sru.bibsys.no/search/authority';
    $schema = 'marcxchange';
    $q = $_GET['q'];
    $m = preg_match('/^([^,]+) ([^, ]+)$/', $q, $matches);
    if ($m) {
        $q = $matches[2] . ', ' . $matches[1];
    }
    $query = 'rec.identifier="' . $q . '" OR bib.namePersonal="' . $q . '*"';
    $limit = 25;

// Lookup publications by id
} else if (isset($_GET['pub'])) {
    $p = new BibliographicParser;
    $schema = 'marcxchange';
    $url = 'http://sru.bibsys.no/search/biblio';
    $query = 'bs.autid="' . $_GET['pub'] . '"';
    $limit = 25;

// Lookup VIAF
} else if (isset($_GET['viaf'])) {
    $p = new ViafParser;
    $url = 'http://viaf.org/viaf/search';
    $schema = 'default'; // VIAF-XML
    $query = 'cql.any="' . $_GET['viaf'] . '"';
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
    'version' => '1.1',
    'user-agent' => 'BsAutSearch/0.1'
));

$response = $client->search($query, $start, $limit, $extras);
$url = $client->urlTo($query, $start, $limit, $extras);
if ($response->error) {
    echo json_encode(array(
        'url' => $url,
        'error' => $response->error
    ));
    exit;
}
$out = array(
	'url' => $url,
    'numberOfRecords' => $response->numberOfRecords,
	'records' => array(),
    'nextRecordPosition' => $response->nextRecordPosition,
);

foreach ($response->records as $record) {
    $record->data->registerXPathNamespace('viaf', 'http://viaf.org/viaf/terms#');

    // xpath union not supported for some reason
    $el = $record->data->first('marc:record') ?: $record->data->first('viaf:VIAFCluster');

	$out['records'][] = $p->parse($el);
}

//header('Access-Control-Allow-Origin: *');
header('Content-type: application/json; charset=utf-8');
if (version_compare(PHP_VERSION, '5.4.0') >= 0) {
    echo json_encode($out, JSON_PRETTY_PRINT);
} else {
    echo json_encode($out);
}
