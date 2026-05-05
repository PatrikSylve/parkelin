import './style.css';

import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';

import {
  Style,
  Stroke,
  Text,
  Fill,
  Circle as CircleStyle
} from 'ol/style';

import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';

// ---------------- HELPERS ----------------

function formatTime(val) {
  return String(val).padStart(2, '0') + ':00';
}

// ---------------- TIME ----------------

const now = new Date();
const todayDate = now.getDate();
const todayHour = now.getHours();

const tomorrow = new Date();
tomorrow.setDate(todayDate + 1);
const tomorrowDate = tomorrow.getDate();

// ---------------- CONFIG ----------------

const LABEL_MIN_ZOOM = 14;

let map; // needed for style access

// ---------------- PARKING LAYER ----------------

const parkingSource = new VectorSource({
  url: 'data/parking.geojson',
  format: new GeoJSON({
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  })
});

const parkingLayer = new VectorLayer({
  source: parkingSource,
  style: function (feature) {
    const day = feature.get('day');
    const stop = feature.get('time_stop');

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

// ---------------- LABELS ----------------

// Create midpoint label features
function createLabelFeatures(features) {
  return features.map((feature) => {
    const geometry = feature.getGeometry();
    const midpoint = geometry.getCoordinateAt(0.5);

    return new Feature({
      geometry: new Point(midpoint),
      original: feature
    });
  });
}

const labelSource = new VectorSource();

const clusterSource = new Cluster({
  distance: 20,
  source: labelSource
});

// ---------------- LABEL LAYER ----------------

const labelLayer = new VectorLayer({
  source: clusterSource,
  style: function (feature) {
    const zoom = map.getView().getZoom();

    // hide labels when zoomed out
    if (zoom < LABEL_MIN_ZOOM) {
      return null;
    }

    const features = feature.get('features');
    const size = features.length;

    // ---------------- SINGLE LABEL ----------------
    if (size === 1) {
      const original = features[0].get('original');

      const day = original.get('day');
      const start = original.get('time_start');
      const stop = original.get('time_stop');

      let color = '#000';

      if (day === todayDate && todayHour < stop) {
        color = 'red';
      } else if (day === tomorrowDate) {
        color = 'orange';
      }

      return new Style({
        text: new Text({
          text: `(${day}) ${formatTime(start)}-${formatTime(stop)}`,
          font: '14px sans-serif',
          fill: new Fill({ color }),
          stroke: new Stroke({
            color: '#fff',
            width: 3
          })
        })
      });
    }

    // ---------------- CLUSTER LABEL ----------------
    return new Style({
      image: new CircleStyle({
        radius: 12,
        fill: new Fill({ color: 'rgba(0,0,0,0.6)' })
      }),
      text: new Text({
        text: String(size),
        font: 'bold 12px sans-serif',
        fill: new Fill({ color: '#fff' }),
        stroke: new Stroke({
          color: '#000',
          width: 2
        })
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
    labelLayer
  ],
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

// ---------------- UPDATE LABELS ON LOAD ----------------

parkingSource.on('featuresloadend', function () {
  const features = parkingSource.getFeatures();

  const labelFeatures = createLabelFeatures(features);

  labelSource.clear();
  labelSource.addFeatures(labelFeatures);

  const extent = parkingSource.getExtent();

  map.getView().fit(extent, {
    padding: [20, 20, 20, 20],
    maxZoom: 17
  });
});

// ---------------- FORCE STYLE UPDATE ON ZOOM ----------------

map.getView().on('change:resolution', () => {
  labelLayer.changed();
});