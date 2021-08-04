<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once('../vendor/autoload.php');

use Carbon\Carbon;
use Danmichaelo\QuiteSimpleXMLElement\QuiteSimpleXMLElement;
use League\ISO3166\Exception\ISO3166Exception;
use League\ISO3166\ISO3166;
use ML\JsonLD\JsonLD;
use Scriptotek\Marc\Fields\Field;
use Scriptotek\Marc\Record;
use Scriptotek\Sru\Client as SruClient;


const SOME_RECORD = 'some_record';

const JSKOS_CONTEXT_EXTENDED = '{
  "uri": "@id",
  "type": {
    "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    "@type": "@id",
    "@container": "@set"
  },
  "created": {
    "@id": "http://purl.org/dc/terms/created"
  },
  "issued": {
    "@id": "http://purl.org/dc/terms/issued"
  },
  "modified": {
    "@id": "http://purl.org/dc/terms/modified"
  },
  "creator": {
    "@id": "http://purl.org/dc/terms/creator",
    "@container": "@set"
  },
  "contributor": {
    "@id": "http://purl.org/dc/terms/contributor",
    "@container": "@set"
  },
  "publisher": {
    "@id": "http://purl.org/dc/terms/publisher",
    "@container": "@set"
  },
  "partOf": {
    "@id": "http://purl.org/dc/terms/isPartOf",
    "@container": "@set"
  },
  "url": {
    "@id": "http://xmlns.com/foaf/0.1/page",
    "@type": "@id"
  },
  "identifier": {
    "@id": "http://purl.org/dc/terms/identifier",
    "@container": "@set"
  },
  "notation": {
    "@id": "http://www.w3.org/2004/02/skos/core#notation",
    "@container": "@set"
  },
  "prefLabel": {
    "@id": "http://www.w3.org/2004/02/skos/core#prefLabel",
    "@container": "@language"
  },
  "altLabel": {
    "@id": "http://www.w3.org/2004/02/skos/core#altLabel",
    "@container": "@language"
  },
  "hiddenLabel": {
    "@id": "http://www.w3.org/2004/02/skos/core#hiddenLabel",
    "@container": "@language"
  },
  "note": {
    "@id": "http://www.w3.org/2004/02/skos/core#note",
    "@container": "@language"
  },
  "scopeNote": {
    "@id": "http://www.w3.org/2004/02/skos/core#scopeNote",
    "@container": "@language"
  },
  "definition": {
    "@id": "http://www.w3.org/2004/02/skos/core#definition",
    "@container": "@language"
  },
  "example": {
    "@id": "http://www.w3.org/2004/02/skos/core#example",
    "@container": "@language"
  },
  "historyNote": {
    "@id": "http://www.w3.org/2004/02/skos/core#historyNote",
    "@container": "@language"
  },
  "editorialNote": {
    "@id": "http://www.w3.org/2004/02/skos/core#editorialNote",
    "@container": "@language"
  },
  "changeNote": {
    "@id": "http://www.w3.org/2004/02/skos/core#changeNote",
    "@container": "@language"
  },
  "subject": {
    "@id": "http://purl.org/dc/terms/subject",
    "@container": "@set"
  },
  "subjectOf": {
    "@reverse": "http://purl.org/dc/terms/subject",
    "@container": "@set"
  },
  "depiction": {
    "@id": "http://xmlns.com/foaf/0.1/depiction",
    "@type": "@id",
    "@container": "@set"
  },
  "narrower": {
    "@id": "http://www.w3.org/2004/02/skos/core#narrower",
    "@container": "@set"
  },
  "broader": {
    "@id": "http://www.w3.org/2004/02/skos/core#broader",
    "@container": "@set"
  },
  "related": {
    "@id": "http://www.w3.org/2004/02/skos/core#related",
    "@container": "@set"
  },
  "previous": {
    "@id": "http://rdf-vocabulary.ddialliance.org/xkos#previous",
    "@container": "@set"
  },
  "next": {
    "@id": "http://rdf-vocabulary.ddialliance.org/xkos#next",
    "@container": "@set"
  },
  "startDate": "http://schema.org/startDate",
  "endDate": "http://schema.org/endDate",
  "relatedDate": "http://www.w3.org/2000/01/rdf-schema#seeAlso",
  "location": "http://schema.org/location",
  "ancestors": {
    "@id": "http://www.w3.org/2004/02/skos/core#broaderTransitive",
    "@container": "@set"
  },
  "inScheme": {
    "@id": "http://www.w3.org/2004/02/skos/core#inScheme",
    "@container": "@set"
  },
  "topConceptOf": {
    "@id": "http://www.w3.org/2004/02/skos/core#topConceptOf",
    "@container": "@set"
  },
  "topConcepts": {
    "@id": "http://www.w3.org/2004/02/skos/core#hasTopConcept",
    "@container": "@set"
  },
  "versionOf": {
    "@id": "http://purl.org/dc/terms/isVersionOf",
    "@container": "@set"
  },
  "extent": "http://purl.org/dc/terms/extent",
  "languages": {
    "@id": "http://purl.org/dc/terms/language",
    "@container": "@set"
  },
  "license": {
    "@id": "http://purl.org/dc/terms/license",
    "@container": "@set"
  },
  "namespace": "http://rdfs.org/ns/void#uriSpace",
  "uriPattern": "http://rdfs.org/ns/void#voidRegexPattern",
  "fromScheme": "http://rdfs.org/ns/void#subjectsTarget",
  "toScheme": "http://rdfs.org/ns/void#objectsTarget",
  "memberList": {
    "@id": "http://www.loc.gov/mads/rdf/v1#componentList",
    "@container": "@list"
  },
  "memberSet": {
    "@id": "http://www.w3.org/2004/02/skos/core#member",
    "@container": "@set"
  },
  "memberChoice": {
    "@id": "http://www.w3.org/2004/02/skos/core#member",
    "@container": "@set"
  },
  "count": "http://rdfs.org/ns/void#entities",
  "distributions": {
    "@id": "http://www.w3.org/ns/dcat#distribution",
    "@container": "@set"
  },
  "download": "http://www.w3.org/ns/dcat#downloadURL",
  "mimetype": "http://www.w3.org/ns/dcat#mediaType",
  "format": "http://purl.org/dc/terms/format",

  "birthDate": "https://schema.org/birthDate",
  "deathDate": "https://schema.org/deathDate"
}';


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

        // Leader
        $ldr = str_split($record->getLeader());
        $data['deleted'] = false;
        $data['replaced_by'] = null;
        if (in_array($ldr[5], ['d', 'x', 's'])) {
            $data['deleted'] = true;
            if ($ldr[5] == 'x') {
                $data['replaced_by'] = SOME_RECORD;
            }
        }

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
        $data['other_ids'] = [
            'isni' => [],
            'bibbi' => [],
            'viaf' => [],
        ];
        foreach ($record->getFields('024') as $field) {
            $data['other_ids'][$field->sf('2')][] = $field->sf('a');
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

        // 370: Associated place
        if ($data['class'] == 'person') {
            $data['place_birth'] = null;
            $data['place_death'] = null;
            $data['place_residence'] = null;
            foreach ($record->getFields('370') as $field) {
                if ($field->sf('a')) {
                    $data['place_birth'] = $field->sf('a');
                }
                if ($field->sf('b')) {
                    $data['place_death'] = $field->sf('b');
                }
                if ($field->sf('e')) {
                    $data['place_residence'] = [
                        'name' => $field->sf('e'),
                        'start' => $field->sf('s'),
                        'end' => $field->sf('t'),
                    ];
                }
            }
        }

        // 374: Occupation (R)
        if ($data['class'] == 'person') {
            $data['occupations'] = [];
            foreach ($record->getFields('374') as $field) {
                $data['occupations'][] = [
                    'value' => $field->sf('a'),
                    'from' => $field->sf('s'),
                    'until' => $field->sf('t'),
                ];
            }
            // Alias occupation to the last value to make utilizing easier
            $data['occupation'] = (count($data['occupations']) > 0)
                ? $data['occupations'][count($data['occupations']) - 1]['value']  // assume sane ordering for now
                : null;
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
                    'until' => $field->sf('t'),
                );
            }
            // Alias gender to the last value to make utilizing easier
            $data['gender'] = (count($data['genders']) > 0)
                ? $data['genders'][count($data['genders']) - 1]['value']  // assume sane ordering for now
                : null;
        }

        // 386: Nasjonalitet / geografisk tilhørighet
        $data['nationality_bs'] = $record->query('386$a{$2=\bs-nasj}')->text();
        $data['nationality_bibbi'] = $record->query('386$a{$2=\bibbi}')->text();
        $data['countries'] = [];
        foreach ($record->getFields('043') as $field) {
            foreach ($field->getSubfields('c') as $sf) {
                $countryCode = $sf->getData();
                try {
                    $data['countries'][] = (new ISO3166())->alpha2($countryCode);
                } catch (ISO3166Exception $ex) {
                    $data['countries'][] = [
                        'alpha2' => mb_strtoupper($countryCode),
                    ];
                }
            }
        }

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

        // 672: Title Related to the Entity
        $data['titles'] = [];
        foreach ($record->getFields('672') as $field) {
            $value = $field->sf('a');
            if ($field->sf('b')) {
                $value .= ' ' . $field->sf('b');
            }
            $data['titles'][] = [
                'value' => $value,
                'date' => $field->sf('f'),
            ];
        }

        $data['notes'] = [];

        // 678: Biographical or Historical Data
        foreach ($record->getFields('678') as $field) {
            $value = $field->sf('a');
            if ($field->sf('b')) {
                $value .= ' ' . $field->sf('b');
            }
            $data['notes'][] = [
                'value' => $value,
            ];
        }

        // 680: Public General Note
        // Example record: 7046226 Hen, L.R.
        foreach ($record->getFields('680') as $field) {
            $value = '';
            foreach ($field->getSubfields() as $sf) {
                if (in_array($sf->getCode(), ['i', 'a'])) {
                    if (strlen($value) !== 0) {
                        $value .= ' ';
                    }
                    $value .= $sf->getData();
                }
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

        if ($f007[0] == 'c' && $f007[1] == 'r') {
            $data['material_type'] = 'online';
        } elseif ($f007[0] == 's') {
            $data['material_type'] = 'audio';
        } elseif ($f007[0] == 'v') {
            $data['material_type'] = 'video';
        }

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

$limit = 25;
if (isset($_GET['limit'])) {
    $limit = intval($_GET['limit']);
}

// Lookup by id
if (isset($_GET['id'])) {

    $url = 'https://authority.bibsys.no/authority/rest/authorities/v2/' . $_GET['id'] . '?format=xml';

    $res = Requests::get($url);
    $x = new AuthorityRecord(QuiteSimpleXMLElement::make($res->body));
    $rec = $x->toArray();

    $res2 = Requests::get('https://authority.bibsys.no/authority/rest/authorities/v2/' . $_GET['id'] . '?format=json');
    $jsonRec = json_decode($res2->body);

    if ($rec['replaced_by'] == SOME_RECORD) {
        // Erstatnings-ID ikke inkludert i MARCXML enda. Sendt mail Bibsys-support 2020-07-09
        $rec['replaced_by'] = [];
        $rec['replaced_by']['id'] = $jsonRec->replacedBy;

        $res3 = Requests::get('https://authority.bibsys.no/authority/rest/authorities/v2/' . $jsonRec->replacedBy . '?format=xml');
        $replacementRecord = new AuthorityRecord(QuiteSimpleXMLElement::make($res3->body));
        $rec['replaced_by']['record'] = $replacementRecord->toArray();
    }

    $rec['origin'] = $jsonRec->origin;

    echo json_encode([
        'url' => $url,
        'numberOfRecords' => 1,
        'records' => [$rec],
    ], JSON_PRETTY_PRINT);
    exit;

// Search by query
} else if (isset($_GET['q'])) {
    $p = AuthorityRecord::class;
    $url = 'https://authority.bibsys.no/authority/rest/sru';
    $schema = 'marcxchange';
    $q = $_GET['q'];

    $scope = isset($_GET['scope']) ? $_GET['scope'] : 'everything';
    $validScopes = [
        'everything' => ['search' => 'cql.allIndexes', 'sort' => null],
        'persons' => ['search' =>'bib.namePersonal', 'sort' =>'bib.namePersonal'],
        'corporations' => ['search' => 'bib.nameCorporate', 'sort' => 'bib.nameCorporate'],
        'meetings' => ['search' => 'bib.nameConference', 'sort' => 'bib.nameConference'],
    ];
    $scope = isset($validScopes[$scope]) ? $validScopes[$scope] : $validScopes['everything'];

    if (preg_match('/^([^,]+) ([^, ]+)$/', $q, $matches)) {
        $q = $matches[2] . ', ' . $matches[1];
    }
    if (preg_match('/^[0-9]+$/', $q)) {
        $query = 'rec.identifier="' . $q . '"';
    } elseif (preg_match('/^"(.*)"$/', $q, $matches)) {
        $query = $scope['search'] . '="' . addslashes($q) . '"';
    } else {
        $query = $scope['search'] . '="' . addslashes($q) . '*"';
    }
    if (isset($scope['sort'])) {
        $query .= ' sortBy ' . $scope['sort'];
    }

// Lookup publications by id
} else if (isset($_GET['pub'])) {
    $p = BibliographicRecord::class;
    $schema = 'marcxml';
    $sru_version = '1.2';
    $url = 'https://bibsys-network.alma.exlibrisgroup.com/view/sru/47BIBSYS_NETWORK';
    $query = 'alma.authority_id="(NO-TrBIB)' . $_GET['pub'] . '" sortBy alma.main_pub_date/sort.descending';

// Lookup VIAF
} else if (isset($_GET['viaf'])) {
    $p = ViafRecord::class;
    $url = 'http://viaf.org/viaf/search';
    $schema = 'default'; // VIAF-XML
    $query = 'local.source="bibsys|' . $_GET['viaf'] . '"';
    $limit = 1;
    $extras = array('httpAccept' => 'application/xml');

// Lookup Bibbi
} else if (isset($_GET['bibbi'])) {

    $url = 'https://id.bs.no/bibbi/' . $_GET['bibbi'];
    $res = Requests::get($url, [
        'Accept' => 'application/json',
    ]);

    $ld = JsonLD::expand($res->body);
    $ld = JsonLD::compact($ld, JSKOS_CONTEXT_EXTENDED);

    echo json_encode($ld);
    exit;

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
    echo json_encode([
        'items' => array_map(function($binding) { return $binding->q->value; }, $bindings),
    ]);
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
$out = [
    'url' => $url,
    'numberOfRecords' => $response->numberOfRecords,
    'records' => [],
    'nextRecordPosition' => $response->nextRecordPosition,
];

foreach ($response->records as $record) {
    $record->data->registerXPathNamespace('marc', 'http://www.loc.gov/MARC21/slim');
    $record->data->registerXPathNamespace('viaf', 'http://viaf.org/viaf/terms#');

    // xpath union not supported for some reason
    $el = $record->data->first('marc:record') ?: $record->data->first('viaf:VIAFCluster');

    $x = new $p($el);
    $out['records'][] = $x->toArray();
}

echo json_encode($out, JSON_PRETTY_PRINT);
