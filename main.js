let time = null;

console.log('%cのぼりべつジェネレーター %cクッソ適当なコードゆるして', 'font-weight: bold; font-size: large', '');


let checkNum = (n) => {
  if (n && Number.isFinite(n)) {
    return n;
  } else {
    return false;
  }
}
$(function() {
  let noboribetsu = new Noboribetsu(() => {
    let fontManager = new FontManager();
    fontManager.onchange(() => {
      noboribetsu.setFont(fontManager.font);
    });

    $(".loading").hide();

    $("#save").on("click", function() {
      let config = {
        str: $("#string").val(),
        size: parseFloat($("#size").val()),
        y: 80,
        z: 50,
        time: parseFloat($("#speed").val()),
        wait: parseFloat($("#wait").val()),
        space: parseFloat($("#spacing").val()),
        textColor: $("#textColor").val() ? "#" + $("#textColor").val() : "",
        sideColor: $("#sideColor").val() ? "#" + $("#sideColor").val() : "",
        border: $("#border").prop("checked"),
        allmode: $("#all").prop("checked")
      }

      noboribetsu.setConfig(config);
      if ($("#backgroundColor").val()) {
        $("body").css("backgroundColor", `#${$("#backgroundColor").val()}`);
      }
    });

    $("#container").on("click", function() {
      noboribetsu.init();
      noboribetsu.start();
    });
  });

  $("#settings_toggle").on("click", function() {
    let current = $("#settings_container").data("show");
    if (current) {
      $("#settings_container").css("left", "-22em").data("show", false);
      $(this).text(">");
    } else {
      $("#settings_container").css("left", "0").data("show", true);
      $(this).text("<");
    }
  });
});


class Noboribetsu {
  constructor(cb) {
    this.defaultFont;
    this.font;
    $.get("./fonts/Gen_Shin_Gothic_Monospace_Bold.json").then((d) => {
      this.defaultFont = new THREE.Font(JSON.parse(d));
      cb();
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, 1920 / 1080, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });

    let ambientLight = new THREE.AmbientLight(0xFFFFFF);
    ambientLight.color.multiplyScalar(0.6);
    this.scene.add(ambientLight);
    /*
        let light = new THREE.PointLight(0xFFFFFF, 0.6);
        light.position.set(0, -20, 100);
        this.scene.add(light);

        light = new THREE.PointLight(0xFFFFFF, 0.3);
        light.position.set(0, 60, 150);
        this.scene.add(light);
        */
    let light = new THREE.DirectionalLight(0xFFFFFF, 0.5);
    light.position.set(0, -100, 0);
    this.scene.add(light);

    light = new THREE.DirectionalLight(0xFFFFFF, 0.5);
    light.position.set(0, 0, 100);
    this.scene.add(light);

    this.renderer.setSize(1920, 1080);
    document.getElementById("container").appendChild(this.renderer.domElement);
    this.camera.position.set(0, 30, 50 + 119);
    this.camera.rotation.x = -0.03;

    this.config = {}

    this.configDefault = {
      str: "のぼりべつ",
      size: 30,
      y: 80,
      z: 50,
      time: 0.09,
      space: 5,
      textColor: "#ECD71E",
      sideColor: "#877800",
      wait: 0.13,
      border: true,
      allmode: false
    }

    this.status = {
      setting: {},
      geoList: [],
      meshList: [],
      state: [],
      running: false,
      requestStart: false,
      waiting: false
    }
    requestAnimationFrame(this.render.bind(this));
  }

  init() {
    this.clear();
    this.status.setting = Object.assign({}, this.configDefault, this.config);

    this.status.setting.time = this.status.setting.time > 0 ? this.status.setting.time : 0.01;
    this.status.setting.wait = this.status.setting.wait > 0 ? this.status.setting.wait : 0;

    let s = this.status.setting.size + this.status.setting.space;
    let totalWidth = this.status.setting.str.length * s;
    this.status.positionArray = new Array(this.status.setting.str.length).fill(0).map((v, i) => {
      return -(totalWidth / 2) + (s / 2) + (i * s);
    });
    this.status.state = new Array(this.status.setting.str.length).fill(false);
    this.setCamera(totalWidth, this.status.setting.z);
  }

  start() {
    let material = [
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(this.status.setting.textColor),
        overdraw: 0.5
      }),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(this.status.setting.sideColor),
        overdraw: 0.5
      }),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(0x000000),
        overdraw: 0.5
      })
    ];

    let widthList = [];
    for (let i = 0; i < this.status.setting.str.length; i++) {
      let font = this.font && this.font.data.glyphs[this.status.setting.str[i]] ? this.font : this.defaultFont;

      let geo = new THREE.TextGeometry(this.status.setting.str[i], {
        font: font,
        size: this.status.setting.size,
        height: 1,
        curveSegments: 16
      });

      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      geo.applyMatrix(new THREE.Matrix4().makeTranslation(-geo.boundingSphere.center.x, 0, -1));

      widthList.push((checkNum(geo.boundingBox.max.x) || 0) - (checkNum(geo.boundingBox.min.x) || 0));

      geo.vertices.forEach(v => {
        if (v.z === -1)
          v.x = v.y = 0;
      });
      geo.mergeVertices();
      geo.computeFaceNormals();

      let mesh = new THREE.Mesh(geo, material.slice(0, 2));

      if (this.status.setting.border) {
        let geo2 = new THREE.TextGeometry(this.status.setting.str[i], {
          font: font,
          size: this.status.setting.size,
          height: 0,
          curveSegments: 16,
          bevelEnabled: true,
          bevelThickness: 0,
          bevelSize: 0.3,
          bevelSegments: 1
        });

        geo2.computeBoundingSphere();
        geo2.applyMatrix(new THREE.Matrix4().makeTranslation(-geo2.boundingSphere.center.x, 0, 0));
        let mesh2 = new THREE.Mesh(geo2, [
          material[0],
          material[2]
        ]);
        mesh.add(mesh2);
      }

      mesh.position.x = 0;
      mesh.scale.set(0.1, 0.1, 1);

      this.status.geoList.push(geo);
      this.status.meshList.push(mesh);

      mesh.visible = false;

      this.scene.add(mesh);
    }

    let totalWidth = widthList.reduce((prev, current) => prev + current);
    totalWidth += this.status.setting.space * (this.status.setting.str.length - 1);
    let c = -(totalWidth / 2);
    let positionList = widthList.map((v, i, a) => {
      if (i === 0) {
        return c += v / 2;
      } else {
        c += a[i - 1] / 2;
        return c += v / 2 + this.status.setting.space;
      }
    });

    this.status.positionArray = positionList;

    time = null;
    this.status.requestStart = true;
  }

  setCamera(width, z) {
    let vf = 1080 / 1920 * 80;
    let z1 = z + width / 2 / Math.tan(80 / 2 * (Math.PI / 180));
    let z2 = z + (this.status.setting.y + this.status.setting.size) / 2 / Math.tan(vf / 2 * (Math.PI / 180));
    let zz = Math.max(150, z1, z2);

    this.camera.position.set(0, 30, zz);
    this.camera.lookAt(0, 25, 0);
  }

  clear() {
    this.status.meshList.forEach(v => {
      this.scene.remove(v);
    });
    this.status.meshList = [];
    this.status.geoList = [];
    this.status.state = [];

    this.status.running = false;
    this.status.waiting = false;
    this.status.requestStart = false;
    time = null;
  }

  render(timestamp) {
    if (this.status.running) {
      if (!time)
        time = timestamp;

      let delta = (timestamp - time) / 1000;

      let progress = this.status.setting.wait && this.status.waiting ? delta / this.status.setting.wait : (delta / this.status.setting.time) + 0.01;

      let a = Math.min(progress, 1);

      if (!this.status.setting.wait || !this.status.waiting) {

        for (let i = 0; i < this.status.setting.str.length; i++) {
          if (this.status.state[i])
            continue;

          let v = this.status.geoList[i];
          v.verticesNeedUpdate = true;
          v.vertices.forEach((v) => {
            if (v.z < 0) {
              v.x = -(this.status.positionArray[i] * a) / a;
              v.y = -this.status.setting.y * a / a;
              v.z = -this.status.setting.z * a - 1;
            }
          });
          v = this.status.meshList[i];

          if (!v.visible)
            v.visible = true;

          v.position.set(this.status.positionArray[i] * a, this.status.setting.y * a, this.status.setting.z * a);
          v.scale.set(a, a, 1);

          if (a === 1) {
            this.status.state[i] = true;
            time = 0;
            if (i === this.status.setting.str.length - 1) {
              this.status.running = false;
            } else if (this.status.setting.wait) {
              this.status.waiting = true;
            }
          }
          if (!this.status.setting.allmode) break;
        }
      } else if (this.status.setting.wait && this.status.waiting) {
        if (a === 1) {
          this.status.waiting = false
          time = 0;
        }
      }
    } else if (this.status.requestStart) {
      this.status.requestStart = false;
      this.status.running = true;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setConfig(config) {
    Object.keys(config).forEach(k => config[k] !== 0 && !config[k] && config[k] !== false && delete config[k]);
    this.config = Object.assign({}, this.configDefault, config);
  }

  setFont(font) {
    this.font = font;
  }
}
