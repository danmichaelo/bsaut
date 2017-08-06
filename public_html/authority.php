<?php

header('Access-Control-Allow-Origin: https://www.wikidata.org');
header('Access-Control-Allow-Headers: x-requested-with');
header('Access-Control-Allow-Credentials: true');

// ----------------------------------------------------------------------------
// File: providers/SearchProvider.php
abstract class SearchProvider
{

	protected function request($url, $data = null)
	{
		$curl = curl_init();
		curl_setopt_array($curl, array(
			CURLOPT_RETURNTRANSFER => 1,
			CURLOPT_URL => $url,
			CURLOPT_POST => is_null($data) ? 0 : 1,
			CURLOPT_POSTFIELDS => $data,
			CURLOPT_FAILONERROR => true,
			CURLOPT_USERAGENT => 'TODO',
		));
		$response = curl_exec($curl);
		if (!$response){
			fail('Failed to get ' . $url . ', error: "' . curl_error($curl) . '" - code: ' . curl_errno($curl));
		}
		curl_close($curl);

		return $response;
	}
	protected function getJson($url, $params) {
		return json_decode($this->request($url . '?' . http_build_query($params)));
	}
}

// ----------------------------------------------------------------------------
// File: providers/Bibsys.php
class Bibsys extends SearchProvider
{
	public function search($value)
	{
		$data = $this->getJson('https://tools.wmflabs.org/bsaut/api.php', [
			'q' => $value,
		]);
		return array_map(function($result) {
			$desc = $result->class;
			if (isset($result->birth) && isset($result->death)) {
				$desc .= " ({$result->birth}-{$result->death})";
			} elseif (isset($result->birth)) {
				$desc .= " ({$result->birth}-)";
			}
			return [
				'id' => $result->id,
				'label' => $result->name,
				'aliases' => $result->altLabels,
				'description' => $desc,
			];
		}, $data->records);
	}
}

// ----------------------------------------------------------------------------
// File: providers/Geonames.php
class Geonames extends SearchProvider
{
	public function search($value)
	{
		if (is_numeric($value)) {
			$result = $this->getJson('http://api.geonames.org/getJSON', [
				'geonameId' => $value,
				'username' => 'danmichaelo',
			]);
			$desc = $result->fcodeName . ' in ' . $result->countryName;
			return [[
				'id' => $result->geonameId,
				'label' => $result->name,
				'description' => $desc,
			]];

		}

		$data = $this->getJson('http://api.geonames.org/searchJSON', [
			'name' => $value,
			'maxRows' => 20,
			'username' => 'danmichaelo',
		]);
		return array_map(function($result) {
			$desc = $result->fcodeName . ' in ' . $result->countryName;
			return [
				'id' => $result->geonameId,
				'label' => $result->name,
				'description' => $desc,
			];
		}, $data->geonames);
	}
}

// ----------------------------------------------------------------------------
function json($arr) {
	header('Content-type: application/json; charset=utf-8');
	echo json_encode($arr, JSON_PRETTY_PRINT);
	exit;
}

function fail($msg) {
	json(['error' => $msg]);
}

function search($property, $value) {

	$providers = [
		'P1015' => Bibsys::class,
		'P1566' => Geonames::class
	];

	if (!isset($providers[$property])) {
		fail('Property not supported');
	}

	$provider = new $providers[$property];

	return ['results' => $provider->search($value) ?: []];
}


$property = isset($_GET['property']) ? $_GET['property'] : null;
$value = isset($_GET['value']) ? $_GET['value'] : null;

if (!$property || !$value) {
	fail('both property and value must be set');
}

json(search($property, $value));
