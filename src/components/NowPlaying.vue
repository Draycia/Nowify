<template>
  <div id="app">
    <div
      v-if="player.playing"
      v-touch:swipe.left="swipeLeft"
      v-touch:swipe.right="swipeRight"
      v-touch-options="{swipeTolerance: 80, touchHoldTolerance: 300}"
      class="now-playing"
      :class="getNowPlayingClass()"
    >
      <div class="now-playing__cover">
        <img
          :src="player.trackAlbum.image"
          :alt="player.trackTitle"
          class="now-playing__image"
        />
      </div>
      <div class="now-playing__details">
        <h1 class="now-playing__track" v-text="player.trackTitle"></h1>
        <h2 class="now-playing__artists" v-text="getTrackArtists"></h2>
        
        <b-progress
          v-if="playerResponse.progress_ms"
          :style="{
            'background-color': colourPalette.background,
            'border-radius': '0',
            'border-width': '1px',
            'border-color': colourPalette.text,
            'border-style': 'solid' 
          }"
          class="now-playing__progressbar"
          height="1rem"
          :max="playerResponse.item.duration_ms"
        >
          <b-progress-bar :value="playerResponse.progress_ms" :style="{ 'background-color': colourPalette.text }"></b-progress-bar>
        </b-progress>

        <div class="now-playing__display">
          <h1 class="now-playing__progress" v-text="msToDuration(playerResponse.progress_ms)"></h1>
          <h2 class="now-playing__seperator"> - </h2>
          <h1 class="now-playing__duration" v-text="msToDuration(playerResponse.item.duration_ms)"></h1>
        </div>
      </div>
    </div>
    <div v-else
      class="now-playing"
      :class="getNowPlayingClass()"
      v-touch:tap="handleTap"
    >
      <h1 class="now-playing__idle-heading">
        No music is playing 😔
        <br/>
        Tap anywhere to resume last played song!
      </h1>
    </div>
  </div>
</template>

<script>
import * as Vibrant from 'node-vibrant'

import props from '@/utils/props.js'

export default {
  name: 'NowPlaying',

  props: {
    auth: props.auth,
    endpoints: props.endpoints,
    player: props.player
  },

  data() {
    return {
      bars: [
        { variant: 'success', value: 75 }
      ],
      pollPlaying: '',
      playerResponse: {},
      playerData: this.getRecentlyPlayed(),
      recentlyPlayed: {},
      hasRecentlyPlayed: false,
      colourPalette: '',
      swatches: [],
      timer: ''
    }
  },

  computed: {
    /**
     * Return a comma-separated list of track artists.
     * @return {String}
     */
    getTrackArtists() {
      return this.player.trackArtists.join(', ')
    }
  },

  mounted() {
    this.setDataInterval()
  },

  beforeDestroy() {
    clearInterval(this.pollPlaying)
  },

  created() {
    setInterval(this.updateProgress, 25)
  },

  methods: {
    /**
     * Make the network request to Spotify to
     * get the current played track.
     */
    async getNowPlaying() {
      let data = {}

      try {
        const response = await fetch(
          `${this.endpoints.base}/${this.endpoints.nowPlaying}`,
          {
            headers: {
              Authorization: `Bearer ${this.auth.accessToken}`
            }
          }
        )

        /**
         * Fetch error.
         */
        if (!response.ok) {
          throw new Error(`An error has occured: ${response.status}`)
        }

        /**
         * Spotify returns a 204 when no current device session is found.
         * The connection was successful but there's no content to return.
         */
        if (response.status === 204) {
          data = this.getRecentlyPlayed()
          this.playerData = data

          this.$nextTick(() => {
            this.$emit('spotifyTrackUpdated', data)
          })

          return
        }

        data = await response.json()
        this.playerResponse = data
      } catch (error) {
        this.handleExpiredToken()

        data = this.getRecentlyPlayed()
        this.playerData = data

        this.$nextTick(() => {
          this.$emit('spotifyTrackUpdated', data)
        })
      }
    },

    async swipeLeft() {
      await fetch(
        "https://api.spotify.com/v1/me/player/next",
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.auth.accessToken}`
          }
        }
      )

      await fetch(
        "https://guc-spclient.spotify.com/canvaz-cache/v0/canvases",
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.auth.accessToken}`
          },
          body: this.playerResponse.id
        }
      )

      this.getNowPlaying()
    },

    async swipeRight() {
      await fetch(
        "https://api.spotify.com/v1/me/player/previous",
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.auth.accessToken}`
          }
        }
      )

      this.getNowPlaying()
    },

    async handleTap() {
      await fetch(
        "https://api.spotify.com/v1/me/player/play",
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.auth.accessToken}`
          }
        }
      )

      this.getNowPlaying()
    },

    /**
     * Get the Now Playing element class.
     * @return {String}
     */
    getNowPlayingClass() {
      const playerClass = this.player.playing ? 'active' : 'idle'
      return `now-playing--${playerClass}`
    },

    /**
     * Get the colour palette from the album cover.
     */
    getAlbumColours() {
      /**
       * No image (rare).
       */
      if (!this.player.trackAlbum?.image) {
        return
      }

      /**
       * Run node-vibrant to get colours.
       */
      Vibrant.from(this.player.trackAlbum.image)
        .quality(2)
        .clearFilters()
        .getPalette()
        .then(palette => {
          this.handleAlbumPalette(palette)
        })
    },

    async getRecentlyPlayed() {
      const response = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=1",
        {
          headers: {
            Authorization: `Bearer ${this.auth.accessToken}`
          }
        }
      )

      if (!response.ok) {
        throw new Error(`An error has occured: ${response.status}`)
      }

      const track = (await response.json()).items[0].track

      return {
        playing: false,
        trackArtists: track.artists.map(artist => artist.name),
        trackId: track.id,
        trackAlbum: {
          title: track.album.name,
          image: track.album.images[0].url
        },
        trackTitle: track.name
      }
    },

    /**
     * Poll Spotify for data.
     */
    setDataInterval() {
      clearInterval(this.pollPlaying)
      this.pollPlaying = setInterval(() => {
        this.getNowPlaying()
      }, 2500)
    },

    /**
     * Set the stylings of the app based on received colours.
     */
    setAppColours() {
      document.documentElement.style.setProperty(
        '--color-text-primary',
        this.colourPalette.text
      )

      document.documentElement.style.setProperty(
        '--colour-background-now-playing',
        this.colourPalette.background
      )
    },

    /**
     * Handle newly updated Spotify Tracks.
     */
    handleNowPlaying() {
      if (
        this.playerResponse.error?.status === 401 ||
        this.playerResponse.error?.status === 400
      ) {
        window.console.log('throw error')
        this.handleExpiredToken()

        return
      }

      /**
       * Player is active, but user has paused.
       */
      if (this.playerResponse.is_playing === false) {
        this.playerData = this.getRecentlyPlayed()

        return
      }

      /**
       * The newly fetched track is the same as our stored
       * one, we don't want to update the DOM yet.
       */
      if (this.playerResponse.item?.id === this.playerData.trackId) {
        return
      }

      /**
       * Store the current active track.
       */
      this.playerData = {
        playing: this.playerResponse.is_playing,
        trackArtists: this.playerResponse.item.artists.map(
          artist => artist.name
        ),
        trackTitle: this.playerResponse.item.name,
        trackId: this.playerResponse.item.id,
        trackAlbum: {
          title: this.playerResponse.item.album.name,
          image: this.playerResponse.item.album.images[0].url
        }
      }
    },

    /**
     * Convert milliseconds to a duration string.
     */
    msToDuration(duration) {
      var seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

      if (hours != 0) {
        minutes = minutes < 10 ? '0' + minutes : minutes
      }

        seconds = seconds < 10 ? '0' + seconds : seconds

      if (hours == 0) {
        return minutes + ":" + seconds
      }

      return hours + ':' + minutes + ':' + seconds
    },

    /**
     * Updates the progress bar.
     * This probably isn't perfectly accurate, but it does the job.
     */
    updateProgress() {
      if (this.playerData.playing) {
        this.playerResponse.progress_ms += 25
      }
    },

    /**
     * Handle newly stored colour palette:
     * - Map data to readable format
     * - Get and store random colour combination.
     */
    handleAlbumPalette(palette) {
      let albumColours = Object.keys(palette)
        .filter(item => {
          return item === null ? null : item
        })
        .map(colour => {
          return {
            text: palette[colour].getTitleTextColor(),
            background: palette[colour].getHex()
          }
        })

      this.swatches = albumColours

      this.colourPalette =
        albumColours[Math.floor(Math.random() * albumColours.length)]

      this.$nextTick(() => {
        this.setAppColours()
      })
    },

    /**
     * Handle an expired access token from Spotify.
     */
    handleExpiredToken() {
      clearInterval(this.pollPlaying)
      this.$emit('requestRefreshToken')
    }
  },
  watch: {
    /**
     * Watch the auth object returned from Spotify.
     */
    auth: function(oldVal, newVal) {
      if (newVal.status === false) {
        clearInterval(this.pollPlaying)
      }
    },

    /**
     * Watch the returned track object.
     */
    playerResponse: function() {
      this.handleNowPlaying()
    },

    /**
     * Watch our locally stored track data.
     */
    playerData: function() {
      this.$emit('spotifyTrackUpdated', this.playerData)

      this.$nextTick(() => {
        this.getAlbumColours()
      })
    }
  }
}
</script>

<style src="@/styles/components/now-playing.scss" lang="scss" scoped></style>
