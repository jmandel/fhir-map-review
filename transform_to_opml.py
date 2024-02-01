import json
import sys
from xml.etree.ElementTree import Element, SubElement, ElementTree

def json_to_opml(json_path, opml_path):
    with open(json_path, 'r') as file:
        episodes = json.load(file)

    opml = Element('opml')
    opml.set('version', '2.0')
    head = SubElement(opml, 'head')
    title = SubElement(head, 'title')
    title.text = 'Podcast Subscriptions'

    body = SubElement(opml, 'body')
    feeds_outline = SubElement(body, 'outline', text='feeds')

    feeds = {}
    for episode in episodes:
        feed_title = episode['feedTitle']
        feed_url = episode['feedUrl']
        episode_status = episode.get('episodeStatus', '')
        min_left = episode.get('minLeft', 0)

        if feed_title not in feeds:
            feeds[feed_title] = {'url': feed_url, 'episodes': []}

        episode_data = {
            'episodeUrl': episode.get('episodeUrl', ''),
            'episodeGuid': episode.get('episodeGuid', ''),
            'episodeStatus': episode_status,
            'minLeft': str(min_left) if episode_status != 'unplayed' else '0'
        }
        feeds[feed_title]['episodes'].append(episode_data)

    for feed_title, feed_info in feeds.items():
        feed_outline = SubElement(feeds_outline, 'outline', type='rss', text=feed_title, xmlUrl=feed_info['url'])
        for episode in feed_info['episodes']:
            attrs = {
                'type': 'rss-item',
                'text': episode['episodeUrl'],
                'itemGuid': episode['episodeGuid'],
                'itemStatus': episode['episodeStatus']
            }
            if episode['episodeStatus'] != 'unplayed':
                attrs['itemMinRemaining'] = episode['minLeft']
            SubElement(feed_outline, 'outline', **attrs)

    tree = ElementTree(opml)
    tree.write(opml_path, encoding='utf-8', xml_declaration=True)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python json_to_opml.py <input_json_file> <output_opml_file>")
        sys.exit(1)
    json_to_opml(sys.argv[1], sys.argv[2])
