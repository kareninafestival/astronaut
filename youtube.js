/*
    getting youtube videos
*/

require('./arrayutil');
var request = require('request');
var moment = require('moment');

var MINIMUM_VIDEO_DURATION_SEC = 10;
var REQUEST_DELAY_MSEC = 2000;
var API_KEY = process.env.YT_API_KEY;

function pad(num, size) {
    var s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
}

function parseVids(obj) {
    if (obj.hasOwnProperty('items')) {
        var items = obj['items'];
        return items.map(function(item) {
            var duration = moment.duration(
                item['contentDetails']['duration']).asSeconds();

            return {
                id: item['id'],
                uploaded: item['snippet']['publishedAt'],
                viewCount: item['statistics']['viewCount'],
                duration: duration
            };
        });
    }
    return [];
}

function createQueries(startIndex, endIndex, tags) {
    queries = [];
    // construct queries to consume
    for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];
        var j = startIndex;
        for (var j = endIndex; j >= startIndex; j--) {
            var params = {
                embed: 'allowed',
                time: 'this_week'
            };
            params['q'] = '\"' + tag + ' ' + pad(j, 4) + '\"';
            queries.push(params);
        }
    }
    return queries;
}


/*
search youtube

params {
    q: the search term
    nextPageToken: optional next page token
}

cb(error, vids, nextParams)
*/
function search(params, cb) {
    params['key'] = API_KEY;
    params['part'] = params['part'] || 'snippet';
    params['type'] = params['type'] || 'video';
    params['order'] = params['order'] || 'date';
    params['maxResults'] = 50;

    request({
        uri: 'https://www.googleapis.com/youtube/v3/search',
        qs: params
    }, function(error, response, body) {

        if (error) {
            cb(error, [], null);
            return;
        }

        var data = JSON.parse(body);
        var ids = data['items'].map(
            function(item) {return item['id']['videoId'];});
        var nextParams = data['nextPageToken'];

        listVideos(ids, function(error, vids) {
            vids = vids.filter(function(vid) {
                return vid.duration > MINIMUM_VIDEO_DURATION_SEC;
            });
            cb(error, vids, nextParams)
        });
    });
}

/*
    List endpoint
    gets additional metadata for video ids

    videoIds: ['ckjkfjl3', 'lckajckl2']
    cb: function(error, videoObjects)
*/
function listVideos(videoIds, cb) {

    var params = {};
    params['key'] = API_KEY;
    params['part'] = 'id,statistics,contentDetails,snippet';
    params['id'] = videoIds.join(',');
    params['maxResults'] = 50;

    request({
        uri: 'https://www.googleapis.com/youtube/v3/videos',
        qs: params
    }, function(error, response, body) {
        if (error) {
            var videos = [];
        } else {
            videos = parseVids(JSON.parse(body));
        }
        cb(error, videos);
    });
}


/*
    retrieves youtube videos of the form

        TAG 000X

    ex. DSC 0001

    tags: is an array of number prefixes ex. dsc, img
    startIndex:   'DSC 0001' would be 1
    endIndex:     'DSC 0234' would be 234
    vidCallback:  function(vids) processes an array of vidids
    endCallback:  function() called when everything is done
*/
function getVids(args) {

    var tags = args.tags || [];
    var startIndex = args.startIndex || 1;
    var endIndex = args.endIndex || 10;
    var maxResultsPerQuery = args.maxResultsPerQuery || -1;
    var vidCallback = args.vidCallback;

    console.log('Getting youtube vids:');
    console.log('tags: ', tags);
    console.log('startIndex: ', startIndex);
    console.log('endIndex: ', endIndex);
    console.log('maxResultsPerQuery: ', maxResultsPerQuery);
    console.log('');

    var queries = createQueries(startIndex, endIndex, tags);
    // shuffle them so the indices are not contiguous
    queries.shuffle();

    var queryVidCount = {}; // keeps track of page counts per query

    function work() {

        var params = queries.pop();
        console.log('search for: ', params['q']);

        search(params, function(error, vids, nextParams) {
            if (error) {
                console.log('Got error: ' + error);
                return;
            }

            console.log('retrieved', vids.length, 'vids');
            vidCallback(vids);

            if (queryVidCount[params.q]) {
                queryVidCount[params['q']] += vids.length;
            } else {
                queryVidCount[params['q']] = vids.length;
            }

            // check if we need to schedule more work
            if (nextParams && queryVidCount[params['q']] < maxResultsPerQuery) {
                queries.push(nextParam);
            }

            if (queries.length > 0) {
                setTimeout(work, REQUEST_DELAY_MSEC);
            }

        });
    }

    work();
}

exports.listVideos = listVideos;
exports.search = search;
exports.getVids = getVids;
