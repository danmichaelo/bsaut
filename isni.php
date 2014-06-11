<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once('vendor/autoload.php');
use Scriptotek\Sru\Client as SruClient;

class IsniParser
{
    
    function parse($dom)
    {
        $out = array();
        $out['id'] = $dom->text('ISNIAssigned/isniUnformatted');
        $out['url'] = $dom->text('ISNIAssigned/isniURI');
        return $out;
    }
}

$extras = array();

$start = isset($_GET['start'])
    ? intval($_GET['start'])
    : 1;

if (!isset($_GET['name'])) {
    die('no query given');
}

$p = new IsniParser;
$url = 'http://isni.oclc.nl/sru/';
$schema = 'isni-b'; // VIAF-XML
$query = 'pica.na="' . $_GET['name'] . '"';  // ser ikke ut som det finnes en indeks for oppslag i VIAF-nr
$limit = 1;
$extras = array('httpAccept' => 'application/xml');

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

    // xpath union not supported for some reason
    $el = $record->data->first('responseRecord');

	$out['records'][] = $p->parse($el);
}

//header('Access-Control-Allow-Origin: *');
header('Content-type: application/json; charset=utf-8');
if (version_compare(PHP_VERSION, '5.4.0') >= 0) {
    echo json_encode($out, JSON_PRETTY_PRINT);
} else {
    echo json_encode($out);
}
