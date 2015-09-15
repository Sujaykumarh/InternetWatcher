/*
Github: https://github.com/sujaykumarh
Blog:   https://sujaykumarh.com/

Copyright (C) 2015 Sujaykumar.Hublikar <hello@sujaykumarh.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const NMC = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Soup = imports.gi.Soup;

let iAvailable = false; //Is internet available?
let faceHappy = "face-smile-big-symbolic"; //Happy face is internet is Up
let faceSad = "face-crying-symbolic"; //Sad face is internet is Down

let macAddr = "00:00:00:00:00:00"; //Default MAC Address
let ipAddr = "0.0.0.0"; //Default IP Address
let eipAddr = "0.0.0.0"; //Default External Ip Address
let deviceType = "unknown"; //Default device type

let iDevAct = false; //Is Internet device ACTIVE?
let deviceStateChanged = true; //Has Internet device state changed?

let macItem; // MenuItem for MAC Adress
let ipItem; // MenuItem for IP Adress
let eipItem; // MenuItem for External Ip Adress
let typeItem; // MenuItem for device type

const PopUpMenu = new Lang.Class({
  Name: 'InternetWatcher.Menu',
  Extends: PanelMenu.Button,
  _init: function() {
    this.parent(0.0, _("InternetWatcher"));

    let hbox = new St.BoxLayout({
      style_class: 'panel-status-menu-box'
    });
    this.icon = new St.Icon({
      icon_name: faceHappy,
      style_class: 'system-status-icon'
    });

    hbox.add_child(this.icon);
    this.actor.add_child(hbox);
    macItem = new PopupMenu.PopupMenuItem("MAC: " + macAddr);
    ipItem = new PopupMenu.PopupMenuItem("IP: " + ipAddr);
    eipItem = new PopupMenu.PopupMenuItem("Ext IP: " + eipAddr);
    typeItem = new PopupMenu.PopupMenuItem("Type: " + deviceType);

    this.menu.addMenuItem(typeItem);
    this.menu.addMenuItem(macItem);
    this.menu.addMenuItem(ipItem);
    this.menu.addMenuItem(eipItem);

    this.client = NMC.Client.new();
    //Check every 2 seconds for device state changed
    this._update_handler = Mainloop.timeout_add_seconds(2, Lang.bind(this,
      function() {
        if (deviceStateChanged)
          this._getDeviceData(this.client);
        if (!iAvailable) {
          this._getEIP();
          this._updateEIP();
        }
        return true;
      }));
    //Check every 30 seconds for External IP Adress changed
    this._update_handler = Mainloop.timeout_add_seconds(30, Lang.bind(
      this,
      function() {
        this._getEIP();
        this._updateEIP();
        return true;
      }));

    this._network_monitor = Gio.network_monitor_get_default();
    this._network_monitor.connect('network-changed', Lang.bind(this, this
      ._onNetworkStateChanged));
  },
  // Update External Ip Adress
  _updateEIP: function() {
    if (eipItem.label.get_text() != eipAddr) {
      if (eipAddr == "0.0.0.0") {
        iAvailable = false;
        this._updateImage();
        eipItem.label.set_text("Ext IP: 0.0.0.0");
      } else {
        iAvailable = true;
        this._updateImage();
        eipItem.label.set_text("Ext IP: " + eipAddr);
      }
    }
  },
  // network-changed
  _onNetworkStateChanged: function() {
    deviceStateChanged = true;
  },
  // Update Menu View
  _showMenu: function(show) {
    if (show)
      this.actor.show();
    else
      this.actor.hide();
  },
  // Get External Ip Adress
  _getEIP: function() {
    if (iDevAct) {
      //URL to get External IP adress and parse using Soup
      var url = "http://ipv4.icanhazip.com/";
      var _httpSession = new Soup.SessionAsync();
      Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
      var request = Soup.Message.new('GET', url);
      _httpSession.queue_message(request, function(_httpSession, message) {
        eipAddr = request.response_body.data;
        if (eipAddr == null) {
          eipAddr = "0.0.0.0";
        }
      });
    }
  },
  // Get Device Data
  _getDeviceData: function(client) {
    let _devices = client.get_devices();
    for (let device of _devices) {
      let ipconf = device.get_ip4_config();
      let ifc = device.get_iface();
      if (ipconf != null && device.get_state() == NetworkManager.DeviceState
        .ACTIVATED) {
        let type = this._get_device_type(device.get_device_type());
        if (type == "ETHERNET" || type == "WIFI") {
          iDevAct = true;
          deviceType = type;
          ipAddr = this._decodeIp4(device.get_ip4_config().get_addresses()[
            0].get_address());
          macAddr = device.get_hw_address();
          deviceStateChanged = false;
          break;
        } else {
          iDevAct = false;
        }
      } else {
        iDevAct = false;
      }
    }
    this._updateData();
  },
  // Update device data
  _updateData: function() {
    if (iDevAct) {
      macItem.label.set_text("MAC: " + macAddr);
      ipItem.label.set_text("IP: " + ipAddr);
      typeItem.label.set_text("Type: " + deviceType);
    } else {
      macItem.label.set_text("MAC: " + "00:00:00:00:00:00");
      ipItem.label.set_text("IP: " + "0.0.0.0");
      eipItem.label.set_text("Ext IP: " + "0.0.0.0");
      typeItem.label.set_text("Type: " + "unknown");
      iAvailable = false;
      this._updateImage();
    }
  },
  // Update Image
  _updateImage: function() {
    if (iAvailable) { //If Internet is available
      this.icon.set_icon_name(faceHappy);
    } else { //If Internet is not available
      this.icon.set_icon_name(faceSad);
    }
  },
  // Get IP v4 fromat data
  _decodeIp4: function(num) {
    num = num >>> 0;
    let array = Uint8Array(4);
    array[0] = num;
    array[1] = num >> 8;
    array[2] = num >> 16;
    array[3] = num >> 24;

    return array[0] + '.' + array[1] + '.' + array[2] + '.' + array[3];
  },
  // Get devie type
  _get_device_type: function(device) {
    switch (device) {
      case NetworkManager.DeviceType.ETHERNET:
        return "ETHERNET";
      case NetworkManager.DeviceType.WIFI:
        return "WIFI";
      default:
        return "none";
    }
  }
});

let popUpMenu;
//Init function
function init() {
  popUpMenu = new PopUpMenu;
  Main.panel.addToStatusArea('internetWatcher', popUpMenu);
}
//on enable function
function enable() {
  popUpMenu._showMenu(true);
}
//on disable function
function disable() {
  popUpMenu._showMenu(false);
}
