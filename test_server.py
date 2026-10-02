import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from unittest import mock

import server


class LocateClaims(unittest.TestCase):
    def test_finds_exact_quote_and_never_alters_text(self):
        text = "Paris is the capital of Germany. Water boils at 100C."
        claims = [{"quote": "capital of Germany", "correction": "France", "explanation": "x"}]
        located, dropped = server.locate_claims(text, claims)
        self.assertEqual(dropped, 0)
        c = located[0]
        self.assertEqual(text[c["start"]:c["end"]], "capital of Germany")

    def test_drops_quotes_not_in_text(self):
        located, dropped = server.locate_claims("Hello world", [{"quote": "Goodbye"}, {"quote": ""}])
        self.assertEqual((located, dropped), ([], 2))

    def test_duplicate_quotes_map_to_distinct_spans(self):
        text = "It is 5 miles. Really, it is 5 miles."
        claims = [{"quote": "it is 5 miles"}, {"quote": "It is 5 miles"}]
        located, _ = server.locate_claims(text, claims)
        self.assertEqual([(c["start"], c["end"]) for c in located], [(0, 13), (23, 36)])

    def test_whitespace_differences_tolerated_and_original_text_returned(self):
        text = "The sun orbits\nthe Earth."
        located, _ = server.locate_claims(text, [{"quote": "sun orbits the Earth"}])
        self.assertEqual(located[0]["quote"], "sun orbits\nthe Earth")

    def test_offsets_are_utf16_units(self):
        text = "\U0001F600 Moon is cheese"  # emoji = 2 UTF-16 units, 1 code point
        located, _ = server.locate_claims(text, [{"quote": "Moon is cheese"}])
        self.assertEqual(located[0]["start"], 3)
        self.assertEqual(located[0]["end"], 3 + len("Moon is cheese"))


class Endpoint(unittest.TestCase):
    def setUp(self):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:%d/api/check" % self.httpd.server_address[1]

    def tearDown(self):
        self.httpd.shutdown()

    def post(self, body):
        req = urllib.request.Request(self.url, json.dumps(body).encode(), {"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    def test_end_to_end_with_stubbed_model(self):
        fake = [{"quote": "Germany", "correction": "Paris is in France.", "explanation": "Wrong country."}]
        with mock.patch.object(server, "ask_claude", return_value=fake):
            status, data = self.post({"text": "Paris is in Germany."})
        self.assertEqual(status, 200)
        self.assertEqual(data["claims"][0]["start"], 12)
        self.assertEqual(data["unplaced"], 0)

    def test_empty_text_rejected(self):
        status, data = self.post({"text": "  "})
        self.assertEqual(status, 400)

    def test_missing_api_key_gives_clear_error(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            status, data = self.post({"text": "hi"})
        self.assertEqual(status, 500)
        self.assertIn("ANTHROPIC_API_KEY", data["error"])


if __name__ == "__main__":
    unittest.main()
