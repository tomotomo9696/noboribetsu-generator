$(function() {
  
});

class FontManager {
  constructor() {
    this.font = null;
    this.selectedFont = null;

    this._callback = function() {};

    this.fdb = new FontDB(() => {
      this.updateList();
    });

    let self = this;

    $("#openFontManager").on("click", () => {
      if (!this.fdb.canuse) {
        window.alert("このブラウザではフォント選択機能を利用できません。");
        return;
      }
      $("#fontManager").show();
    });

    $("#fontManager > .close").on("click", function() {
      $("#fontManager").hide();
    });

    $('#fontFile').on("change", function() {
      $("#loadFileStatus").text("読み込んでるゼェェイ!");
      $(this).prop("disabled", true);

      let file = this.files[0];
      if (file != null) {
        let reader = new FileReader();
        reader.addEventListener('load', async e => {
          let font = opentype.parse(e.target.result);
          let result = convert(font);

          await self.fdb.addWriteQueue(font.names.fontFamily.ja || font.names.fontFamily.en, result);
          self.updateList();

          $("#loadFileStatus").text("読み込んだゼェェイ!");
          $(this).prop("disabled", false);
        }, false);
        reader.readAsArrayBuffer(file);
      }
    });
  }

  async updateList() {
    let items = await this.fdb.getAllItems();
    let e = $("#font_table > tbody").empty();

    $(`<tr><td>デフォルト</td><td><input type="radio" name="font" value="default"></td><td></td></tr>`).appendTo(e).find("input").eq(0).prop("checked", !this.selectedFont);
    items.forEach(v => {
      $(`<tr><td>${v}</td><td><input type="radio" name="font" value="${v}"></td><td><button class="deleteFont" value="${v}">削除</button></td></tr>`).appendTo(e).find("input").eq(0).prop("checked", this.selectedFont === v);
    });

    $('input[name="font"]:radio').on("change", async () => {
      let v = $('input[name="font"]:radio:checked').val();
      if (this.selectedFont === v)
        return;

      $('input[name="font"]:radio').prop("disabled", true);
      this.selectedFont = v === "default" ? null : v;
      this.font = v === "default" ? null : new THREE.Font(await this.fdb.getValue(this.selectedFont));
      $('input[name="font"]:radio').prop("disabled", false);
      this._callback();
    });

    $('.deleteFont').on("click", async e => {
      let v = $(e.currentTarget).val();

      await this.fdb.delete(v);
      if (this.selectedFont === v) {
        this.selectedFont = null;
        this.font = null;
      }

      this.updateList();
    });
  }

  onchange(cb) {
    this._callback = cb;
  }
}

class FontDB {
  constructor(callback) {
    this._canuse = !!window.indexedDB;

    this.dbName = "fontDB";
    this.storeName = "fonts";
    this.dbver = 1;
    this.database = indexedDB.open(this.dbName, this.dbver);

    this.db = null;

    this.writeQueue = [];

    this.opened = false;

    this.database.onupgradeneeded = e => {
      console.log('DB upgrade');

      this.db = e.target.result;
      this.db.createObjectStore('fonts', {
        keyPath: "font_id"
      })
    }
    this.database.onsuccess = async e => {
      console.log('DB open');

      this.db = e.target.result;
      this.dbver = this.db.version;

      this.opened = true;
      this.writeAll();
      callback();
    }
    this.database.onerror = (event) => {
      this._canuse = false;
      console.log('DB open error');
    }
  }

  async addWriteQueue(key, data) {
    this.writeQueue.push({
      font_id: key,
      data: data
    });
    await this.writeAll();
    return;
  }

  async writeAll() {
    if (!this.opened)
      return;

    if (this.writeQueue.length < 1)
      return;

    do {
      let data = this.writeQueue.shift();
      await this.write(data);
    } while (this.writeQueue.length > 0);
    return;
  }

  write(data) {
    return new Promise((resolve, reject) => {
      let tx = this.db.transaction(this.storeName, "readwrite");
      let put = tx.objectStore(this.storeName).put(data);

      put.onsuccess = () => {}

      tx.oncomplete = () => {
        resolve();
      }
    });
  }

  getAllItems() {
    return new Promise((resolve, reject) => {
      let tx = this.db.transaction(this.storeName, IDBTransaction.READ_ONLY);
      let store = tx.objectStore(this.storeName);
      let items = [];
      if (!this.opened)
        return;

      let cursorRequest = store.openKeyCursor();

      cursorRequest.onerror = error => {
        console.log(error);
        reject();
      }

      cursorRequest.onsuccess = e => {

        let cursor = e.target.result;
        if (cursor) {
          items.push(cursor.key);
          cursor.continue();
        }
      }

      tx.oncomplete = () => {
        resolve(items);
      }
    });
  }

  getValue(key) {
    return new Promise((resolve, reject) => {
      let tx = this.db.transaction(this.storeName, 'readonly');
      let store = tx.objectStore(this.storeName);
      let req = store.get(key);

      req.onsuccess = e => {
        resolve(e.target.result.data);
      }

      req.onerror = e => {
        reject();
      }
    });
  }

  delete(key) {
    return new Promise((resolve, reject) => {
      let tx = this.db.transaction(this.storeName, 'readwrite');
      let store = tx.objectStore(this.storeName);
      let req = store.delete(key);

      req.onsuccess = e => {
        resolve();
      };

      req.onerror = e => {
        reject();
      };
    });
  }

  get canuse() {
    return this._canuse;
  }
}

var convert = function(font, reverseTypeface = false) {

  var scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72);
  var result = {};
  result.glyphs = {};

  var restriction = {
    range: null,
    set: null
  };

  Object.keys(font.glyphs.glyphs).forEach(function(glyph) {
    glyph = font.glyphs.glyphs[glyph];
    if (glyph.unicode !== undefined) {
      let glyphCharacter = String.fromCharCode(glyph.unicode);
      let needToExport = true;
      if (needToExport) {

        var token = {};
        token.ha = Math.round(glyph.advanceWidth * scale);
        token.x_min = Math.round(glyph.xMin * scale);
        token.x_max = Math.round(glyph.xMax * scale);
        token.o = ""
        if (reverseTypeface) {
          glyph.path.commands = reverseCommands(glyph.path.commands);
        }

        glyph.path.commands.forEach(function(command, i) {
          if (command.type.toLowerCase() === "c") {
            command.type = "b";
          }
          token.o += command.type.toLowerCase();
          token.o += " "
          if (command.x !== undefined && command.y !== undefined) {
            token.o += Math.round(command.x * scale);
            token.o += " "
            token.o += Math.round(command.y * scale);
            token.o += " "
          }
          if (command.x1 !== undefined && command.y1 !== undefined) {
            token.o += Math.round(command.x1 * scale);
            token.o += " "
            token.o += Math.round(command.y1 * scale);
            token.o += " "
          }
          if (command.x2 !== undefined && command.y2 !== undefined) {
            token.o += Math.round(command.x2 * scale);
            token.o += " "
            token.o += Math.round(command.y2 * scale);
            token.o += " "
          }
        });
        result.glyphs[String.fromCharCode(glyph.unicode)] = token;
      }
    };
  });
  result.familyName = font.names.fontFamily.ja || font.names.fontFamily.en;
  result.ascender = Math.round(font.ascender * scale);
  result.descender = Math.round(font.descender * scale);
  result.underlinePosition = Math.round(font.tables.post.underlinePosition * scale);
  result.underlineThickness = Math.round(font.tables.post.underlineThickness * scale);
  result.boundingBox = {
    "yMin": Math.round(font.tables.head.yMin * scale),
    "xMin": Math.round(font.tables.head.xMin * scale),
    "yMax": Math.round(font.tables.head.yMax * scale),
    "xMax": Math.round(font.tables.head.xMax * scale)
  };
  result.resolution = 1000;
  result.original_font_information = font.tables.name;
  if (font.names.fontSubfamily.en.toLowerCase().indexOf("bold") > -1) {
    result.cssFontWeight = "bold";
  } else {
    result.cssFontWeight = "normal";
  };

  if (font.names.fontSubfamily.en.toLowerCase().indexOf("italic") > -1) {
    result.cssFontStyle = "italic";
  } else {
    result.cssFontStyle = "normal";
  };
  return result;
}

var reverseCommands = function(commands) {
  var paths = [];
  var path;

  commands.forEach(function(c) {
    if (c.type.toLowerCase() === "m") {
      path = [c];
      paths.push(path);
    } else if (c.type.toLowerCase() !== "z") {
      path.push(c);
    }
  });

  var reversed = [];
  paths.forEach(function(p) {
    var result = {
      "type": "m",
      "x": p[p.length - 1].x,
      "y": p[p.length - 1].y
    };
    reversed.push(result);

    for (var i = p.length - 1; i > 0; i--) {
      var command = p[i];
      result = {
        "type": command.type
      };
      if (command.x2 !== undefined && command.y2 !== undefined) {
        result.x1 = command.x2;
        result.y1 = command.y2;
        result.x2 = command.x1;
        result.y2 = command.y1;
      } else if (command.x1 !== undefined && command.y1 !== undefined) {
        result.x1 = command.x1;
        result.y1 = command.y1;
      }
      result.x = p[i - 1].x;
      result.y = p[i - 1].y;
      reversed.push(result);
    }

  });
  return reversed;
}
