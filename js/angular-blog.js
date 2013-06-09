( function( window, document, undefined ) {

  /*------------------------------------

    Private methods

  -------------------------------------*/

  /**
   * Check if a variable is undefined.
   * @param variable {*} The variable to check.
   */
  var no = function( variable ) {
    return ( typeof variable === 'undefined' );
  }

  /**
   * Check if a variable is defined.
   * @param variable {*} The variable to check.
   */
  var is = function( variable ) {
    return ( !no( variable ) );
  }

  /**
   * Search an array of objects with various techniques.
   * @param objects {Array} The array of objects to search.
   */
  var find = function( objects ) {

    var findObject = {};

    /**
     * Search an array of objects for an object with
     * a specific property value.
     * @param prop {String} The name of the property to test.
     * @param value {*} The value we're looking for.
     */
    findObject.thatHas = function( prop, value ) {

      var result = _.find( objects, function( item ) {
        return item[ prop ] == value;
      } );

      if ( no( result ) ) return '';

      return result;
    }

    return findObject;
  }

  /**
   * Asynchronously load an external file.
   * @param url {String} Path to the file to load.
   */
  var load = function( url ) {

    var deferred = Q.defer();
    var ajax;

    if ( window.XMLHttpRequest ) {
      // code for IE7+, Firefox, Chrome, Opera, Safari
      ajax = new XMLHttpRequest();
    } else {
      // code for IE6, IE5
      ajax=new ActiveXObject( "Microsoft.XMLHTTP" );
    }

    ajax.onreadystatechange = function() {
      if ( ajax.readyState == 4 && ajax.status == 200 ) {
        deferred.resolve( ajax.responseText );
      }
    }

    ajax.open( "GET", url, true );
    ajax.send();

    // Return a promise.
    return deferred.promise;
  }

  // TODO: Add these to blog obj?  Put next to the methods that use them?
  var pages = [];
  var posts = [];

  /*------------------------------------

    Acute methods

  -------------------------------------*/

  /**
   * Make a blog.
   * @param {String} name The name of the site.
   * @param {Object} site The JSON data defining the site structure.
   * @returns {Object} An AngularJS app decorated with Acute blog methods.
   */
  var makeBlog = function( params ) {

    // Extract params.
    var siteName = params[ 'name' ],
        jsonUrl = params[ 'data' ];

    // Build our angular app.
    var app = angular.module( siteName, [] );
    // TO-DO: Throw errors if we are overwriting any Angular methods or properties.
    // Incorporate this into tests?

    // Set up our onReady handler.
    app.onReady = function( callback ) {
      app.onReadyCallback = callback;
    }

    load( jsonUrl ).then( function( siteJson ) {

      var siteStructure = JSON.parse( siteJson );

      // Extract site data.
      var postsData   = siteStructure[ 'posts' ],
          pagesData   = siteStructure[ 'pages' ],
          foldersData = siteStructure[ 'folders' ],
          postData    = siteStructure[ 'post' ];
      // TO-DO: Throw errors if any data has been left unspecified.

      // For each directory in our site structure, create a method
      // allowing us to synthesize a URL to a page within it.
      app.pathTo = {};
      _.each( foldersData, function( folder ) {

        // Get a URL to a page in a directory, given the page's name.
        // E.g. pathTo.posts( 'fun' ) returns post/fun.html
        app.pathTo[ folder.contentType ] = function( pageName ) {
          return folder.name + '/' + pageName + '.html';
        };

      } );

      // Store our posts JSON data.
      posts = postsData;

      /**
       * Get a post with a given ID.
       * @param id {String} The post ID.
       */
      var getPost = function( id ) {

        // Create a Post object with the ID.
        var Post = function( id ) {

          // Find the post with the url that matches the given id.
          var post = find( posts ).thatHas( 'url', id );

          // Add a 'name' getter.
          this.__defineGetter__( 'name', function() {
            return post.name;
          });

          // Add a 'contentPath' getter.
          this.__defineGetter__( 'contentPath', function() {
            return app.pathTo.post( id );
          });

        }

        // Return our new Post object.
        return new Post( id );

      }

      // Configure routes based on our JSON data.
      app.config( function( $routeProvider ) {

        /**
         * Add a route.
         * @param {String} route The route URL.
         * @param {String} page The route name, i.e. the text for the link to this page.
         * @param {Boolean} isDefault Whether this is the index page or not.
         */
        var addRoute = function( route, pageName ) {

          // Set up our Angular routes.
          // The templateURL is synthesized based on our site structure.
          $routeProvider.when( route, {
            templateUrl: app.pathTo.page( pageName ),
            controller: pageName
          } );
          
          // Return a representative object that's really
          // just a bunch of convenience methods.
          var methods = {};
          
          // Set this route as the default route.
          methods.setDefault = function( isDefault ) {
            
            if ( isDefault ) {
              $routeProvider.otherwise( {
                redirectTo: route
              } );
            } else {
              // TODO: Add a way to unset default.
            }
            // Allow chaining.
            return methods;
          }

          return methods;
        }

        // Add routes to the pages in our site.
        _.each( pagesData, function( route ) {
          // Set the first page to be the default.
          var isDefault = ( pages.length == 0 );
          addRoute( route.url, route.name ).setDefault( isDefault );
          pages.push( route );
        
        } );

        // Add a route for posts.
        addRoute( postData.url, 'post' );

      } );

      // Add a controller for each page.
      _.each( pagesData, function( route ) {

        app.controller( route.name, function( $scope, $routeParams ) {

          // This data is available to each page.
          $scope.posts = posts;
          $scope.pages = pages;
        
        } );

      } );

      // Add a post controller.
      app.controller( 'post', function( $scope, $routeParams ) {
        
        // This data is available to each post.
        $scope.posts = posts;
        $scope.pages = pages;
        $scope.post = getPost( $routeParams.id );

      } );


      // List of posts component.
      app.directive( 'postsList', function() {

        return {

          restrict: 'E',
          replace: true,
          templateUrl: app.pathTo.component( 'posts-list' ),
          scope: { list: '=' }

        }

      } );

      // Sidebar component.
      app.directive( 'sidebar', function() {

        return {

          restrict: 'E',
          replace: true,
          templateUrl: app.pathTo.component( 'sidebar' ),
          scope: { list: '=' }

        }

      } );

      // Load post content.
      app.directive( 'post', function( $http, $templateCache, $compile ) {

        return {

          restrict: 'E',
          terminal: true,
          compile: function( element, attr ) {

            // Get the 'path' attribute of the DOM element.
            var srcExp = attr[ 'path' ];

            return function( scope, element ) {

              var changeCounter = 0,
                  childScope;

              // Erase the content of the DOM element.
              var clearContent = function() {

                if ( childScope ) {

                  childScope.$destroy();
                  childScope = null;

                }

                element.html('');

              };

              scope.$watch( srcExp, function ngIncludeWatchAction( src ) {

                var thisChangeId = ++changeCounter;

                if ( src ) {

                  // Load the external content.
                  $http.get( src, { cache: $templateCache } ).success( function( response ) {

                    if (thisChangeId !== changeCounter) return;

                    if (childScope) childScope.$destroy();
                    childScope = scope.$new();

                    element.html(response);
                    $compile(element.contents())(childScope);

                    childScope.$emit('$includeContentLoaded');

                  } ).error( function() {

                    if (thisChangeId === changeCounter) clearContent();

                  });

                } else {
                  clearContent();
                }

              });

            };

          }

        };

      } );

      app.compile = function() {
        angular.bootstrap( document, [ siteName ]);
      }

      if ( is( app.onReadyCallback ) ) {
        app.onReadyCallback( app );
      }

    } );

    return app;

  }

  // Create acute.
  var Acute = window[ 'Acute' ] = {
    makeBlog : makeBlog
  }
  
} )( window, document );