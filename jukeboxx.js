(function() {
  var Jukeboxx, FolderExplorer, MusicExplorer;

  var QueueOrder = {
    FILE_APLHA: "file_alpha"
  };

  var RepeatState = {
    NONE: "none",
    ALL: "all",
    ONE: "one"
  }

  Jukeboxx = (function() {
    function Jukeboxx(dbClient, root) {
      this.dbClient = dbClient;
      this.folderExplorer = new FolderExplorer(this.dbClient, (function(_this){
        return function(){
          _this.stopSong();
          _this.musicExplorer.renderMusicView();
        }
      })(this));
      this.musicExplorer = new MusicExplorer(this, this.folderExplorer);

      this.currentSongPath = null;
      this.currentSong = null;
      this.isCurrentSongLoaded = false;
      this.playbackTimer = null;

      this.queueOrder = QueueOrder.FILE_APLHA;
      this.queuedList = [];
      this.queueIndex = 0;

      this.repeat = RepeatState.NONE;
      this.shuffle = false;
      this.prevShuffle = [];
      this.nextShuffle = [];

      this.assureCompatibility();
      this.hookUpClickOns();

      var jbox = this;
      soundManager.setup({
        url: 'lib/soundmanagerv2/swf/',
        debugMode: false,
        onready: function(){
          jbox.setupAuthentication();
        },
        ontimeout: function(){
          showError(null, 'Could not load sound manager!');
        }
      });

      $( "#vol-slider" ).slider({
        orientation: 'horizontal',
        range: 'min',
        max: '100',
        value: 25,
        slide: (function(_this){
          return function(){
            _this.onVolumeChange();
          };
        })(this),
        change: (function(_this){
          return function(){
            _this.onVolumeChange();
          };
        })(this)
      });
      $('#vol-slider').slider('value', 50);
    }

    Jukeboxx.prototype.hookUpClickOns = function(){
      $('#signout-button').click((function(_this) {
        return function(event) {
          return _this.onSignOut(event);
        }
      })(this));
      $('#back-btn').click((function(_this) {
        return function(event) {
          return _this.onBackBtn(event);
        }
      })(this));
      $('#play-pause-btn').click((function(_this) {
        return function(event) {
          return _this.onPlayPauseBtn(event);
        }
      })(this));
      $('#next-btn').click((function(_this) {
        return function(event) {
          return _this.onNextBtn(event);
        }
      })(this));
      $('#repeat-btn-none').click((function(_this) {
        return function(event) {
          return _this.onRepeatBtn(RepeatState.NONE);
        }
      })(this));
      $('#repeat-btn-all').click((function(_this) {
        return function(event) {
          return _this.onRepeatBtn(RepeatState.ALL);
        }
      })(this));
      $('#repeat-btn-one').click((function(_this) {
        return function(event) {
          return _this.onRepeatBtn(RepeatState.ONE);
        }
      })(this));

      $('#repeat-btn-none').trigger('click');

      $('#shuffle-btn').click((function(_this) {
        return function(event) {
          return _this.onShuffleBtn();
        }
      })(this));
      $('#song-progress').click((function(_this) {
        return function(event) {
          return _this.onProgressClick(event);
        }
      })(this));
    }

    Jukeboxx.prototype.assureCompatibility = function(){
      try{//Mozilla Firefox
        this.context = new AudioContext();
      }catch(e){
        try{//Apple Safari and Google Chrome
          this.context = new webkitAudioContext();
        }catch(e){
          //idgaf IE
          showError(e, "Jukeboxx only supports modern browsers, like Mozilla Firefox, not Internet Explorer!");
        }
      }
    }

    Jukeboxx.prototype.setupAuthentication = function (){
      this.dbClient.authenticate({interactive: false}, (function(_this) {
        return function(error, client) {
          if (error) {
            return showError(error, 'Something went wrong :(');
          }
          if (_this.dbClient.isAuthenticated()) {
            // Cached credentials are available, make Dropbox API calls.
            _this.onAuthentication();
          } else {
            // show and set up the "Sign into Dropbox" button
            var $signinButton = $('#signin-button');
            $signinButton.removeClass('hidden');
            $signinButton.click(function(event) {
              _this.dbClient.authenticate(function(error, client) {
                if (error) {
                  return handleError(error);
                }
                _this.onAuthentication();
              });
            });
          }
        };
      })(this));
    }

    Jukeboxx.prototype.onAuthentication = function(){
      /*this.dbClient.getAccountInfo((function(_this){
        return function(error, userInfo) {
          if (error) {
            return showError(error, 'We could not sign you in :(');
          }*/
          var _this = this;//remove to restore getting account info
          $('#app-ui').removeClass('hidden');
          $('#music-panel-heading').text('Songs in your Dropbox');
          $('#music-view').removeClass('hidden');
          $('#song-progress').removeClass('hidden');
          $('#signin-button').addClass('hidden');
          $('#not-signedin').addClass('hidden');
          $('#signout-button').removeClass('hidden');
          _this.folderExplorer.onAuthentication();
          _this.folderExplorer.loadFolder();
        /*}
      })(this));*/
    }

    Jukeboxx.prototype.onSignOut = function(event, task) {
      return this.dbClient.signOut((function(_this) {
        return function(error) {
          if (error) {
            return showError(error, 'We had trouble signing you out :(');
          }
          return window.location.reload();
        };
      })(this));
    }

    Jukeboxx.prototype.onProgressClick = function(event){
      var barWidth = document.getElementById('song-progress').offsetWidth;
      var clickPos = event.pageX;
      var decPct = (clickPos/barWidth);
      if(this.currentSong && this.currentSong.readyState == 3/*SUCCESS*/){
        //console.log(barWidth + ' ' + clickPos + ' ' + decPct);
        this.currentSong.setPosition(this.currentSong.durationEstimate * decPct);
        this.updateProgressBar(this.currentSong);
      }
    }

    Jukeboxx.prototype.onBackBtn = function(){
      if(this.currentSong && this.currentSong.position > 1500){
        if(this.currentSong.readyState == 3/*SUCCESS*/);
        this.currentSong.setPosition(0);
      }else{
        this.stopSong();
        this.playSongAtQueueIndex(this.prevQueueIndex());
      }
    }

    Jukeboxx.prototype.onPlayPauseBtn = function(){
      if(this.currentSong){
        if(this.currentSong.paused){
          this.currentSong.resume();
          this.setPlayPauseButton('pause');
        }else{
          this.currentSong.pause();
          this.setPlayPauseButton('play');
        }
      }else{
        this.playSongAtQueueIndex(0);
      }
    }

    Jukeboxx.prototype.onNextBtn = function(){
      this.stopSong();
      var nextQueueIndex = this.nextQueueIndex();
      if(this.repeat == RepeatState.NONE && nextQueueIndex == 0)
        this.stopSong();
      else
        this.playSongAtQueueIndex(nextQueueIndex);
    }

    Jukeboxx.prototype.setPlayPauseButton = function(state){
      if(state == 'pause' || state == 'play')
        $('#play-pause-btn').html('<span class="glyphicon glyphicon-' + state +'"></span>');
    }

    Jukeboxx.prototype.onShuffleBtn = function(){
      /*this.shuffle = !this.shuffle;
      if(this.shuffle)
        this.setupShuffle();*/
    }

    Jukeboxx.prototype.onRepeatBtn = function(state){

      this.repeat = state;
    }

    Jukeboxx.prototype.onVolumeChange = function(){
      var vol = $('#vol-slider').slider('value');
      if(this.currentSong)
        this.currentSong.setVolume(vol);
    }

    Jukeboxx.prototype.setupShuffle = function(){
      var shuffledQueue = [];
      for(var i = 0; i < this.folderExplorer.files.length; i++)
        shuffledQueue.push(i);
      //fisher-yates shuffle
      for(var i = 0; i < shuffledQueue.length - 1; i++){
        var j = i + Math.floor(Math.random()*(shuffledQueue.length - i));
        var tmp = shuffledQueue[j];
        shuffledQueue[j] = shuffledQueue[i]
        shuffledQueue[i] = tmp;
      }
      this.nextShuffle = shuffledQueue;
      this.prevShuffle = [];
    }

    Jukeboxx.prototype.progressShuffle = function(isForward){
      if(isForward){
        var queueIndex = this.nextShuffle.splice(0, 1);
        this.prevShuffle.push(queueIndex);
      }else{
        if(this.prevShuffle.length > 0){
          var queueIndex = this.prevShuffle.splice(this.prevShuffle.length - 1, 1);
          this.prevShuffle.splice(0, 0, queueIndex);
        }
      }
    }

    Jukeboxx.prototype.nextQueueIndex = function(){
      var next = this.queueIndex;
      if(this.shuffle){
        if(this.nextShuffle.length == 0)
          this.setupShuffle();
        return this.nextShuffle[0];
      }else{
        next++;
        if(next >= this.folderExplorer.files.length)
          next = 0;
      }
      return next;
    }

    Jukeboxx.prototype.prevQueueIndex = function(){
      var prev = this.queueIndex;
      if(this.shuffle){
        if(prevShuffle.length == 0)
          return this.folderExplorer.files.length - 1;
        return this.prevShuffle[this.prevShuffle.length - 1];
      }else{
        prev--;
        if(prev < 0)
          prev = this.folderExplorer.files.length - 1;
      }
      return prev;
    }
    //called only by playSongAtQueueIndex
    Jukeboxx.prototype.prepareCurrentSong = function(){
      var thisQueueIndex = this.queueIndex;
      var thisSongPath = this.currentSongPath;
      this.fetchSongStream(thisSongPath, (function(_this){
        return function(streamlink){
          var s = soundManager.createSound({
            url: streamlink,
            id: thisSongPath,
            volume: $('#vol-slider').slider('value'),
            onplay: function(){
              if(_this.currentSongPath == this.id){
                _this.isCurrentSongLoaded = true;
                _this.playbackTimer = setInterval((function(_song){
                  return function(){
                    if(_this.currentSongPath == _song.id){
                      _this.updateProgressBar(_song);
                    }else{
                      if(_song.readyState == 3/*SUCCESS*/)
                        _song.stop();
                    }
                  };
                })(this), 75);
              }else{
                //can't stop here since it might not be loaded yet!!
                //this.stop();
              }
            },
            onfinish: function(){
              this.stop();
              _this.currentSong = null;
              _this.currentSongPath = null;
              _this.isCurrentSongLoaded = false;
              _this.musicExplorer.setNowPlaying(thisQueueIndex, false);
              if(_this.repeat == RepeatState.NONE){
                if(_this.nextQueueIndex() == 0)
                  _this.stopSong();
                else
                  _this.playSongAtQueueIndex(_this.nextQueueIndex());
              }else if(_this.repeat == RepeatState.ALL){
                _this.playSongAtQueueIndex(_this.nextQueueIndex());
              }else if(_this.repeat == RepeatState.ONE){
                _this.playSongAtQueueIndex(_this.queueIndex);
              }
            },
            whileloading: function(){
              if(_this.currentSongPath == this.id){
                _this.updateProgressBar(this);
              }else{
                this.stop();
              }
            },
            whileplaying: function(){
              if(_this.currentSongPath == this.id){
                _this.updateProgressBar(this);
              }else{
                this.stop();
              }
            } 
          });
          _this.currentSong = s;
          s.play();
        }
      })(this));
    }

    Jukeboxx.prototype.setProgressBar = function(pctPlayed, pctDownloaded){
      $('#playback-progress').attr('style', 'width:'+pctPlayed+'%');
      $('#download-progress').attr('style', 'width:'+(pctDownloaded-pctPlayed)+'%');
    }

    Jukeboxx.prototype.updateProgressBar = function(song){
      var loadPct = (song.bytesLoaded/song.bytesTotal)*100;
      var playPct = (song.position/song.durationEstimate)*100;
      this.setProgressBar(playPct, loadPct);
    }

    Jukeboxx.prototype.fetchSongStream = function(path, callback){
      var xhr = new Dropbox.Util.Xhr('POST', 'https://api.dropbox.com/1/media/dropbox/' + path); 
      var token = this.dbClient.credentials().token;
      xhr.setParams({'access_token': token});
      xhr.setResponseType('json');
      xhr.prepare().send(function(error, response, metadata){
        if(error){
          showError(error, 'Could not find stream resource');
          callback('');
        }
        var link = response['url'];
        callback(link);
      });
    }

    Jukeboxx.prototype.stopSong = function(){
      if(this.currentSong){
        this.currentSong.stop();
      }
      this.currentSong = null;
      this.currentSongPath = null;
      this.isCurrentSongLoaded = false;

      this.musicExplorer.setNowPlaying(-1, false);
      if(this.playbackTimer){
        window.clearInterval(this.playbackTimer);
        this.playbackTimer = null;
      }
      this.setPlayPauseButton('play');
      this.setProgressBar(0, 0);
    }

    Jukeboxx.prototype.processQueueOrder = function(){
      if(this.queueOrder === QueueOrder.FILE_APLHA){

      }
    }

    Jukeboxx.prototype.indexForQueueIndex = function(queueIndex){
      if(this.queueOrder === QueueOrder.FILE_APLHA)
        return queueIndex;
    }

    Jukeboxx.prototype.playSongAtQueueIndex = function(queueIndex){
      if(this.folderExplorer.files.length == 0)
        return;

      var fileIndex = this.indexForQueueIndex(queueIndex);
      var stat = this.folderExplorer.files[fileIndex];
      var path = this.folderExplorer.currentDir + '/' + stat.name;
      var $entry = this.musicExplorer.$songEntryForQueueIndex(queueIndex);
      
      if(this.currentSong){
        this.currentSong.stop();
      }
      this.stopSong();
      this.currentSongPath = path;

      //previous song
      this.musicExplorer.setNowPlaying(this.queueIndex, false);
      this.musicExplorer.setNowPlaying(queueIndex, true);
      this.setPlayPauseButton('pause');

      this.queueIndex = queueIndex;
      
      this.prepareCurrentSong();
    }

    return Jukeboxx;

  })();

  FolderExplorer =  (function() {
    function FolderExplorer(dbClient, loadFolderCallback){
      this.dbClient = dbClient;
      this.folders = [];
      this.files = [];
      this.currentDir = '/';
      this.dirComponents = ['Dropbox'];
      this.loadFolderCallback = loadFolderCallback;
      
      this.$folderList = $('#folder-list');
      this.folderTemplate = $('#folder-template').html().trim();
      this.breadcrumbTemplate = $('#breadcrumb-template').html().trim();
    };

    FolderExplorer.prototype.onAuthentication = function(){
       $('#folder-view').removeClass('hidden');
    }

    //set currentDir before to load
    FolderExplorer.prototype.loadFolder = function(){
      $('#currentDir').text('Current Directory: Dropbox' + this.currentDir);
      this.setComponents();
      this.dbClient.readdir(this.currentDir, (function(_this){
        return function(error, entrynames, stat, entrystats){
          if(error){
            return showError(error, 'We could not load the current folder :(');
          }
          _this.folders = [];
          _this.files = [];
          for(var i = 0; i < entrystats.length; i++){
            //sort entries
            if(entrystats[i].isFolder)
              _this.folders.push(entrystats[i]);
            else
              _this.files.push(entrystats[i]);
          }
          _this.renderFolderView();
          if(_this.loadFolderCallback)
            _this.loadFolderCallback();
        }
      })(this));
    }

    FolderExplorer.prototype.setComponents = function(){
      var arr = this.currentDir.split('/');
      arr.splice(0, 0, 'Dropbox');
      this.dirComponents = [];
      for(var i = 0; i < arr.length; i++){
        if(arr[i].length > 0)
          this.dirComponents.push(arr[i]);
      }
      var folderBcrumb = $('#folder-breadcrumb');
      folderBcrumb.empty();
      var pathComps = [];
      for(var i = 1; i < this.dirComponents.length; i++){
        pathComps.push(this.dirComponents[i]);
      }
      for(var i = 0; i < this.dirComponents.length; i++){
        $bcDom = this.$breadcrumbDom(this.dirComponents[i], pathComps.slice(0, i).join('/'));
        folderBcrumb.append($bcDom);
      }
    }

    FolderExplorer.prototype.$breadcrumbDom = function(foldername, path){
      var $bc;
      $bc = $(this.breadcrumbTemplate);
      $('.bcrumb', $bc).text(foldername);
      $('.bcrumb', $bc).click((function(_this){
        return function(event){
          event.preventDefault();
          _this.currentDir = path;
          _this.loadFolder();
        };
      })(this));
      return $bc;
    }

    FolderExplorer.prototype.renderFolderView = function(){
      this.$folderList.empty();
      for(var i = 0; i < this.folders.length; i++){
        this.$folderList.append(this.$folderEntryDom(this.folders[i]));
      }
    }

    FolderExplorer.prototype.$folderEntryDom = function(stat){
      var $entry;
      $entry = $(this.folderTemplate);
      var folderEntry = $('.folder-name', $entry);
      folderEntry.text(stat.name);
      folderEntry.click((function(_this) {
        return function(event) {
           $('.folder-entry', $entry).addClass('active');
          _this.changeDirectory(stat.path);
        };
      })(this));
      return $entry;
    }

    FolderExplorer.prototype.changeDirectory = function(path){
      this.currentDir = path;
      this.loadFolder();
    }

    return FolderExplorer;
  })();

  MusicExplorer = (function(){
    function MusicExplorer(soundDelegate, folderDelegate){
      this.$songList = $('#music-list');
      this.songTemplate = $('#song-template').html().trim();
      this.soundDelegate = soundDelegate;
      this.folderDelegate = folderDelegate;
    }

    MusicExplorer.prototype.renderMusicView = function(){
      this.$songList.empty();
      for(var i = 0; i < this.folderDelegate.files.length; i++){
        var fileIndex = this.soundDelegate.indexForQueueIndex(i);
        this.$songList.append(this.$songEntryDom(this.folderDelegate.files[fileIndex], i));
      }
      if(this.folderDelegate.files.length == 0){
        this.$songList.html($('#no-music').html().trim());
      }
    }

    MusicExplorer.prototype.$songEntryDom = function(stat, queueIndex){
      var $entry;
      $entry = $(this.songTemplate);
      $entry.attr('id', 'song-entry-' + queueIndex)
      $('.song-name', $entry).text(this.filenameMinusExtension(stat.name));
      $('.song-play-button', $entry).click((function(_this){
        return function(event){
          event.preventDefault();//prevents scrolling to top if link
          _this.onPlay(event, stat, queueIndex);
        };
      })(this));
      return $entry;
    }

    MusicExplorer.prototype.filenameMinusExtension = function(filename){
      var comps = filename.split('.');
      return comps.slice(0, comps.length-1).join('')
    }

    MusicExplorer.prototype.$songEntryForQueueIndex = function(queueIndex){

      return $('#song-entry-' + queueIndex);
    }

    MusicExplorer.prototype.setNowPlaying = function(queueIndex, playing){
      if(queueIndex == -1){
        return $('#now-playing').html('<small>Now Playing:&nbsp;</small>');
      }
      var fileIndex = this.soundDelegate.indexForQueueIndex(queueIndex);
      var stat = this.folderDelegate.files[fileIndex];
      $('#now-playing').html('<small>Now Playing:&nbsp;</small>' + this.filenameMinusExtension(stat.name));
      $entry = this.$songEntryForQueueIndex(queueIndex);
      if(playing){
        $entry.addClass('info');
      }else{
        $entry.removeClass('info');
      }  
    }

    MusicExplorer.prototype.onPlay = function(event, stat, queueIndex){

      this.soundDelegate.playSongAtQueueIndex(queueIndex);
    }

    return MusicExplorer;
  })();

  var showError = function(error, message) {
    $('#error-notice').removeClass('hidden');
    if(message)
      $('#error-message').text(message);
    if (window.console) {
      return console.log(error + ' ' + message);
    }
  };

  $(function() {
    var client;
    client = new Dropbox.Client({
      key: '8f0dxv4um4zp3l4'
    });
    return window.app = new Jukeboxx(client, '#app-ui');
  });

}).call(this);