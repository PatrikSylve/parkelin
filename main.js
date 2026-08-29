import './style.css';
import Geolocation from 'ol/Geolocation';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import Overlay from 'ol/Overlay';
import Select from 'ol/interaction/Select';
import {
    Style,
    Stroke,
    Fill,
    Circle as CircleStyle
} from 'ol/style';

import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';


// -- overlay
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const overlay = new Overlay({
    element: container,
    autoPan: {
        animation: {
            duration: 250,
        },
    },
});
closer.onclick = function () {
    overlay.setPosition(undefined);
    closer.blur();
    return false;
};

// ------ LOCATION -------
const locationSource = new VectorSource();

const locationLayer = new VectorLayer({
    source: locationSource,
    style: new Style({
        image: new CircleStyle({
            radius: 8,
            fill: new Fill({
                color: '#4285F4'
            }),
            stroke: new Stroke({
                color: '#fff',
                width: 3
            })
        })
    })
});

// ---------------- TIME ----------------

let now = new Date();
//now = new Date("2026-08-05T16:15:30");
const todayDate = now.getDate();
const todayHour = now.getHours();

const tomorrow = new Date();
tomorrow.setDate(todayDate + 1);
const tomorrowDate = tomorrow.getDate();


let map; // needed for style access

// ---------------- PARKING LAYER ----------------

const parkingSource = new VectorSource({
    url: 'data/parking.geojson',
    format: new GeoJSON({
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
    })
});

function getStartStopTimeFromFeat(feat) {
    const time = feat.get('tid').split("-");
    // Div by 100 to get hour from format hhmm
    const start = parseInt(time[0]) / 100;
    const stop = parseInt(time[1]) / 100;
    return [start, stop]
}

function getStartTimeFromFeat(feat) {
    return getStartStopTimeFromFeat(feat)[0]
}

function getStopTimeFromFeat(feat) {
    return getStartStopTimeFromFeat(feat)[1]
}

const parkingLayer = new VectorLayer({
    source: parkingSource,
    style: function (feature) {
        const day = parseInt(feature.get('day'));
        const stop = getStopTimeFromFeat(feature);


        let color = 'green';

        if (day === todayDate && todayHour < stop) {
            color = 'red';
        } else if (day === tomorrowDate) {
            color = 'orange';
        }

        return new Style({
            stroke: new Stroke({
                color,
                width: 5
            })
        });
    }
});

// ---------------- MAP ----------------

map = new Map({
    target: 'map',
    layers: [
        new TileLayer({
            source: new OSM()
        }),
        parkingLayer,
        locationLayer
    ],
    overlays: [overlay],
    view: new View({
        center: [0, 0],
        zoom: 2
    })
});

// ---------------- UPDATE LABELS ON LOAD ----------------

parkingSource.on('featuresloadend', function () {
    const extent = parkingSource.getExtent();

    map.getView().fit(extent, {
        padding: [20, 20, 20, 20],
        maxZoom: 17
    });
});

// -- click interaction -------



function selectStyle(feature) {
    const originalStyle = parkingLayer.getStyleFunction()(feature);

    const highlightStyle = new Style({
        stroke: new Stroke({
            color: '#00ff00',
            width: 8,
        }),
    });

    return [originalStyle, highlightStyle];
}
// select interaction working on "singleclick"
const selectSingleClick = new Select({ style: selectStyle, hitTolerance: 15 });
map.addInteraction(selectSingleClick);
selectSingleClick.on('select', function (e) {
    const selectedFeature = e.selected[0];

    if (!selectedFeature) {
        overlay.setPosition(undefined);
        return;
    }
    content.innerHTML = `
      <p>${selectedFeature.get('copy_value')}</p>
    `;

    overlay.setPosition(e.mapBrowserEvent.coordinate);
});


const geolocation = new Geolocation({
    trackingOptions: {
        enableHighAccuracy: true
    },
    projection: map.getView().getProjection()
});

geolocation.setTracking(true);

geolocation.on('change:position', function () {
    const position = geolocation.getPosition();

    if (!position) {
        return;
    }

    locationSource.clear();

    locationSource.addFeature(
        new Feature({
            geometry: new Point(position)
        })
    );

    map.getView().animate({
        center: position,
        zoom: 16,
        duration: 500
    });
});