import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server


class TestChannelEditor(unittest.TestCase):

    def setUp(self):
        self.channels = server.parse_channels()

    def test_parse_channels(self):
        self.assertGreater(len(self.channels), 0)
        first_channel = self.channels[0]
        self.assertIn('name', first_channel)
        self.assertIn('orig_slot', first_channel)
        self.assertIn('is_hd', first_channel)

    def test_ali_binary_export(self):
        binary = server.build_ali_bin_data(self.channels)
        self.assertEqual(len(binary), 689900)

    def test_vestel_sdx_export_and_parse(self):
        sdx_bytes = server.export_vestel_sdx(self.channels)
        self.assertTrue(sdx_bytes.startswith(b'SATCODX103'))
        parsed = server.parse_uploaded_content('test.sdx', sdx_bytes)
        self.assertEqual(len(parsed), len(self.channels))

    def test_m3u_export_and_parse(self):
        m3u_bytes = server.export_m3u(self.channels)
        self.assertTrue(m3u_bytes.startswith(b'#EXTM3U'))
        parsed = server.parse_uploaded_content('test.m3u', m3u_bytes)
        self.assertEqual(len(parsed), len(self.channels))

    def test_csv_export_and_parse(self):
        csv_bytes = server.export_csv_data(self.channels)
        self.assertTrue(csv_bytes.startswith(b'\xef\xbb\xbf'))
        parsed = server.parse_uploaded_content('test.csv', csv_bytes)
        self.assertEqual(len(parsed), len(self.channels))

    def test_json_export_and_parse(self):
        json_bytes = server.export_json_data(self.channels)
        parsed = server.parse_uploaded_content('test.json', json_bytes)
        self.assertEqual(len(parsed), len(self.channels))


if __name__ == '__main__':
    unittest.main()
