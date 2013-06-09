
var blog = Acute.makeBlog( {
  name : 'blogsite',
  data: 'site.json'
} ).;

blog.onReady( function() {
  blog.compile();
} );

blog.onReady( function() {
  blog.compile();
} );

/*

var blog = Acute.makeBlog( {
  name : 'blogsite',
  data: 'site.json',
  components : {
    'sidebar',
    'postsList'
  }
} );

blog.onReady( function() {
  console.log( 'blog loaded' )
} );

*/