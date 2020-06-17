<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once('../vendor/autoload.php');

use Carbon\Carbon;
use Danmichaelo\QuiteSimpleXMLElement\QuiteSimpleXMLElement;
use Scriptotek\Marc\Fields\Field;
use Scriptotek\Marc\Record;
use Scriptotek\Sru\Client as SruClient;


class AuthorityRecord
{
    /**
     * @var array
     */
    private $data;

    // http://www.loc.gov/marc/authority/ad008.html
    public static $cat_rules = [
        'a' => 'Earlier rules',
        'b' => 'AACR 1',
        'c' => 'AACR 2',
        'd' => 'AACR 2 compatible',
        'z' => 'Other',
    ];

    public static $vocabularies = [
        'a' => 'lcsh',
        'b' => 'lccsh', // LC subject headings for children's literature
        'c' => 'mesh', // Medical Subject Headings
        'd' => 'atg', // National Agricultural Library subject authority file (?)
        'k' => 'cash', // Canadian Subject Headings
        'r' => 'aat', // Art and Architecture Thesaurus
        's' => 'sears', // Sears List of Subject Heading
        'v' => 'rvm', // Répertoire de vedettes-matière
    ];

    function __construct(QuiteSimpleXMLElement $dom)
    {
        $record = Record::fromSimpleXMLElement($dom->el);
        $data = [];

        // 001: Control number
        $data['id'] = $record->query('001')->text();

        // 003: MARC code for the agency whose system control number is
        // contained in field 001 (Control Number)
        // See http://www.loc.gov/marc/authority/ecadorg.html
        $data['agency'] = $record->query('003')->text();

        // 005: Modified
        $data['modified'] = $this->parseDateTime($record->query('005')->text())->format('Y-m-d');


        // 008: Extract *some* information
        $f008 = $record->query('008')->text();
        $r = substr($f008, 10, 1);
        $data['cataloging'] = isset(self::$cat_rules[$r]) ? self::$cat_rules[$r] : null;
        $r = substr($f008, 11, 1);
        $data['vocabulary'] = isset(self::$vocabularies[$r]) ? self::$vocabularies[$r] : null;

        // 024: Identifiers
        foreach ($record->getFields('024') as $field) {
            $data['other_ids'][$field->sf('2')] = $field->sf('a');
        }

        // 040:
        $source = $record->getField('040');
        if (!is_null($source)) {
            $data['catalogingAgency'] = $source->sf('a');
            $data['language'] = $source->sf('b');
            $data['transcribingAgency'] = $source->sf('c');
            $data['modifyingAgency'] = $source->sf('d');
            $data['vocabulary'] = $source->sf('f') ?: $data['vocabulary'];
        }

        // 1X0: Name
        $data['class'] = 'unknown';
        $nameField = $record->getField('1.0|111', true);
        if (!is_null($nameField)) {
            $this->parse1xxField($data, $nameField);
        }

        // 375: Gender (R)
        if ($data['class'] == 'person') {
            $data['genders'] = [];
            foreach ($record->getFields('375') as $field) {
                $gendermap = [
                    'm' => 'male',
                    'f' => 'female',
                ];
                $value = isset($gendermap[$field->sf('a')]) ? $gendermap[$field->sf('a')] : $field->sf('a');
                $data['genders'][] = array(
                    'value' => $value,
                    'from' => $field->sf('s'),
                    'until' => $field->sf('e'),
                );
            }
            // Alias gender to the last value to make utilizing easier
            $data['gender'] = (count($data['genders']) > 0)
                ? $data['genders'][count($data['genders']) - 1]['value']  // assume sane ordering for now
                : null;
        }

        // 386: Nasjonalitet / geografisk tilhørighet
        $data['nationality'] = $record->query('386$a{$2=\bs-nasj}')->text();
        $data['geo'] = $record->query('043$c')->text();

        // 4XX: See From Tracing
        foreach ($record->getFields('4.0|411', true) as $field) {
            $data['altLabels'][] = $field->sf('a');
        }

        // 5XX: See Also Tracing
        foreach ($record->getFields('5.0|511', true) as $field) {
            $data['related'][] = [
                'id' => str_replace('(NO-TrBIB)', '', $field->sf('0')),
                'name' => $field->sf('a'),
            ];
        }

        // 678: Biographical or Historical Data
        $data['notes'] = [];
        foreach ($record->getFields('678') as $field) {
            $value = $field->sf('a');
            if ($field->sf('b')) {
                $value .= ' ' . $field->sf('b');
            }
            $data['notes'][] = [
                'value' => $value,
            ];
        }


        // 901: Status
        $data['status'] = $record->query('901$a')->text();

        $this->data = $data;
    }

    public function toArray() {
        return $this->data;
    }

    /**
     * Parse a *Representation of Dates and Times* (ISO 8601).
     * The date requires 8 numeric characters in the pattern yyyymmdd.
     * The time requires 8 numeric characters in the pattern hhmmss.f,
     * expressed in terms of the 24-hour (00-23) clock.
     *
     * @param string $value
     *
     * @return Carbon|null
     */
    protected function parseDateTime($value)
    {
        if (strlen($value) == 6) {
            return Carbon::createFromFormat('ymdHis', $value . '000000');
        }
        if (strlen($value) == 8) {
            return Carbon::createFromFormat('YmdHis', $value . '000000');
        }
        if (strlen($value) == 16) {
            return Carbon::createFromFormat('YmdHis', substr($value, 0, 14));
        } // skip decimal fraction
    }

    private function normalizeName($value)
    {
        $spl = explode(', ', $value);
        if (count($spl) == 2) {
            return $spl[1] . ' ' . $spl[0];
        }
        return $value;
    }

    private function parse1xxField(array &$data, Field $nameField)
    {
        $sf_a = $nameField->sf('a');
        $sf_b = $nameField->sf('b');
        $sf_d = $nameField->sf('d');

        $data['label'] = $sf_a;

        switch ($nameField->getTag()) {

            case '100':
                $data['class'] = 'person';
                $data['name'] = $data['label'];
                if ($nameField->getIndicator(1) === '1') {  // Surnames
                    $data['label'] = $this->normalizeName($data['label']);
                }
                if (!empty($sf_b)) {
                    $data['label'] .= ' ' . $sf_b;
                }
                $bd = explode('-', $sf_d);
                $data['birth'] = $bd[0] ?: null;
                $data['death'] = (count($bd) > 1 && $bd[1]) ? $bd[1] : null;
                break;

            case '110':
                $data['class'] = 'corporation';
                if ($nameField->getIndicator(1) === '0') {  // Inverted name
                    $data['label'] = $this->normalizeName($data['label']);
                }
                if (!empty($sf_b)) {
                    $data['label'] .= ' : ' . $sf_b;
                }
                $data['name'] = $data['label'];
                break;

            case '111':
                $data['class'] = 'meeting';
                if (!empty($sf_b)) {
                    $data['label'] .= ' : ' . $sf_b;
                }
                $data['name'] = $data['label'];
                break;

            case '130':
                $data['class'] = 'title';
                if (!empty($sf_b)) {
                    $data['label'] .= ' : ' . $sf_b;
                }
                $data['name'] = $data['label'];
                foreach ($nameField->getSubfields('d') as $sf) {
                    $data['label'] .= ' (' . trim($sf->getData()) . ')';
                }
                break;
        }
    }
}


class BibliographicRecord
{
    /**
     * @var array
     */
    private $data;

    function __construct(QuiteSimpleXMLElement $dom)
    {
        $record = Record::fromSimpleXMLElement($dom->el);
        $data = [];
        $data['id'] = $record->query('001')->text();

        $data['title'] = $record->getTitle();
        $data['publisher'] = $record->getPublisher();
        $data['year'] = $record->getPubYear();
        $data['creators'] = $record->getCreators();

        $ldr = str_split($record->getLeader());
        $f007 = str_split($record->query('007')->text());
        $f008 = str_split($record->query('008')->text());

        $data['electronic'] = ($f007[0] == 'c' && $f007[1] == 'r');

        $this->data = $data;
    }

    public function toArray() {
        return $this->data;
    }
}


class ViafRecord
{
    function __construct(QuiteSimpleXMLElement $dom)
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
    $p = AuthorityRecord::class;
    $url = 'https://authority.bibsys.no/authority/rest/sru';
    $schema = 'marcxchange';
    $query = 'rec.identifier="' . $_GET['id'] . '"';
    $limit = 1;

// Search by query
} else if (isset($_GET['q'])) {
    $p = AuthorityRecord::class;
    $url = 'https://authority.bibsys.no/authority/rest/sru';
    $schema = 'marcxchange';
    $q = $_GET['q'];

    $scope = isset($_GET['scope']) ? $_GET['scope'] : 'everything';
    $validScopes = [
        'everything' => 'cql.allIndexes',
        'persons' => 'bib.namePersonal',
        'corporations' => 'bib.nameCorporate',
        'meetings' => 'bib.nameConference',
    ];
    $scope = isset($validScopes[$scope]) ? $validScopes[$scope] : 'cql.allIndexes';

    if (preg_match('/^([^,]+) ([^, ]+)$/', $q, $matches)) {
        $q = $matches[2] . ', ' . $matches[1];
    }
    if (preg_match('/^[0-9]+$/', $q)) {
        $query = 'rec.identifier="' . $q . '"';
    } elseif (preg_match('/^"(.*)"$/', $q, $matches)) {
        $query = $scope . '="' . addslashes($q) . '"';
    } else {
        $query = $scope . '="' . addslashes($q) . '*"';
    }

    $limit = 25;

// Lookup publications by id
} else if (isset($_GET['pub'])) {
    $p = BibliographicRecord::class;
    $schema = 'marcxml';
    $sru_version = '1.2';
    $url = 'https://bibsys-network.alma.exlibrisgroup.com/view/sru/47BIBSYS_NETWORK';
    $query = 'alma.authority_id="(NO-TrBIB)' . $_GET['pub'] . '" sortBy alma.main_pub_date/sort.descending';
    $limit = 25;

// Lookup VIAF
} else if (isset($_GET['viaf'])) {
    $p = ViafRecord::class;
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

echo json_encode($out, JSON_PRETTY_PRINT);
