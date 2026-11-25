The hub's shared state (data/cevoc.sqlite) is created here by api/state.php on first save.
It is not in git, so `git pull` keeps it. Back it up by copying the file. The web server must not serve this folder (see .htaccess).
