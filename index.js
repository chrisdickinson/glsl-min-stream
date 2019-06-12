module.exports = minifier

var lang = require('cssauron-glsl')
  , is_variable = lang('decl > decllist > ident')
  , is_function = lang('decl > function > ident')
  , is_named_struct = lang('struct > ident')
  , through = require('through')
  , shortest = require('shortest')

// recognize commutative + but not * as these are conditional
var commutative_operators = ['+', '&&', '||']

function minifier(safe_words, mutate_storages) {
  safe_words = safe_words || ['main']

  var _ = {}
    , seen_names = {}
    , variable_type = new Map()
    , function_type = {}
    , counter

  for(var i = 0, len = safe_words.length; i < len; ++i)
    _[safe_words[i]] = true
  safe_words = _

  counter = shortest()

  return through(mutate)

  function mutate(node) {
    // remove unnecessary grouping operators
    if(is_unnecessary_group(node)) return

    if(node.parent) {
      for(var current = node.parent; current.parent; current = current.parent) {
        if(is_unnecessary_group(current)) {
          current.parent.children[current.parent.children.indexOf(current)] = current.children[0]
          current.children[0].parent = current.parent
        }
      }
    }

    // vec2(1.0, 1.0) => vec2(1.0)
    if(node.parent && is_redundant_vector_literal(node.parent) && node.parent.children.indexOf(node) > 1) return
    if(is_redundant_vector_literal(node)) node.children = node.children.slice(0, 2)

    if(should_mutate(node)) {
      var t = node.parent.parent.children[1]
      if(mutate_storages || (t.type === 'placeholder' || t.token.data === 'const')) {
        var x = seen_names[node.token.data] || counter()
        seen_names[node.token.data] = x
        node.data = x
      }
    }

    if(is_variable(node)) {
      var scope = variable_type.get(node.scope) || {}
      scope[node.data] = node.parent.parent.token.data
      variable_type.set(node.scope, scope)
    }

    if(is_function(node)) function_type[node.data] = node.parent.parent.token.data

    // 1.0 => 1. // 0.1 => .1 // 0.0 => .0
    if(node.type === 'literal') {
      if(/0\.\d/.test(node.data)) node.data = node.data.replace(/^0\./, '.')
      else if(/\d+\.[1-9]*0*$/.test(node.data)) node.data = node.data.replace(/(\d+\.[1-9]*)0*/, "$1")
    }

    this.emit('data', node)
  }

  function get_type(node) {
    if (node.type === 'ident') return variable_type.get(node.scope)[node.data] || 'unidentified'
    if (node.type === 'literal') {
      if (node.data === 'true' || node.data === 'false') return 'bool'
      if (node.data.includes('.')) return 'float'
      return 'int'
    }
    if (node.type === 'call') {
      if (/^int|float|bool|[ib]?vec[234]|mat[234]$/.test(node.children[0].data)) return node.children[0].data
      return function_type[node.children[0].data] || 'unidentified'
    }
    if (node.type === 'binary') {
      if (node.data === '==' || node.data === '&&' || node.data === '||' || node.data === '^^') return 'bool'
      if (node.data === '+' || node.data === '-' || node.data === '/') return get_type(node.children[0])
    }
    if (node.type === 'unary' || node.type === 'group' || node.type === 'suffix') return get_type(node.children[0])
    return 'unidentified'
  }

  function should_mutate(node) {
    var base = (
      is_variable(node) ||
      is_function(node) ||
      is_named_struct(node)
    )

    return base &&
          !safe_words.hasOwnProperty(node.token.data)
  }

  function is_unnecessary_group(node) {
    function is_commutative_multiply(node) {
      if(node.data !== '*') return false
      var type_a = get_type(node.children[0])
        , type_b = get_type(node.children[1])
      if(/^unidentified|mat[234]$/.test(type_a) && /^unidentified|[ib]?vec[234]|mat[234]$/.test(type_b)) return false
      if(/^[ib]?vec[234]$/.test(type_a) && /^unidentified|mat[234]$/.test(type_b)) return false
      return true
    }
    if(node.type !== 'group') return false
    if(node.children[0].lbp > node.parent.lbp) return true
    if(node.children[0].lbp === node.parent.lbp) {
      for(var i = 0; i < commutative_operators.length; i++) {
        if(node.parent.data === commutative_operators[i] && node.children[0].data === commutative_operators[i]) return true
      }
      if(is_commutative_multiply(node.parent) && is_commutative_multiply(node.children[0])) return true
    }
    return false
  }

  function is_redundant_vector_literal(node) {
    if(node.type === 'call' && /^[ib]?vec[234]$/.test(node.children[0].data) &&
      (node.children[1].type === 'literal' || node.children[1].type === 'ident')) {
      var first = node.children[1].data
      for(var i = 2; i < node.children.length; i++) if(node.children[i].data !== first) return false
      return true
    }
    return false
  }
}
