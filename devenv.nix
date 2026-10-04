{ pkgs, ... }:

let
  # Same idea as .lighttpd.conf: real files are served as-is, other paths
  # (Angular routes like /search and /show) fall through to index.html.
  router = pkgs.writeText "bsaut-router.php" ''
    <?php
    $uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
    $file = $_SERVER['DOCUMENT_ROOT'] . $uri;
    if ($uri !== '/' && is_file($file)) {
        return false;
    }
    require $_SERVER['DOCUMENT_ROOT'] . '/index.html';
  '';
in
{
  languages.php = {
    enable = true;
    version = "8.4";
  };

  scripts.serve = {
    exec = "php -S 127.0.0.1:8080 -t public_html ${router}";
    description = "Serve the app at http://127.0.0.1:8080";
  };

  processes.web.exec = "serve";

  enterShell = ''
    echo "PHP $(php -r 'echo PHP_VERSION;')"
    if [ ! -f vendor/autoload.php ]; then
      echo "Dependencies are not installed. Run: composer install"
    fi
    echo "Start the site with: devenv up"
    echo "Then open http://127.0.0.1:8080/"
  '';
}
