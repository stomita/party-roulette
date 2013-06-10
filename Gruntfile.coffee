fs = require 'fs'

module.exports = (grunt) ->
  grunt.loadNpmTasks 'grunt-contrib-less'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-clean'

  grunt.initConfig

    watch:
      files: [ "src/**/*.js", "src/**/*.less" ]
      tasks: [ "build" ]

    copy:
      files:
        expand: true
        cwd: "src/js"
        src: "**/*.js"
        dest: "public/js"
        filter: 'isFile'

    less:
      options:
        compress: true
      files:
        src: "src/less/main.less"
        dest: "public/css/main.css"

    clean: [
      "public/js/**/*.js"
      "public/css/**/*.css"
    ]

  grunt.registerTask 'build', [ 'less', 'copy' ]
  grunt.registerTask 'default', 'build'

