/*
 * Unicode Character Finder
 * Copyright (c) 2010-2017 Grant McLean <grant@mclean.net.nz>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function($) {

    "use strict";

    var block_mask = 0xFFFF80
    var preview_reset_list = 'unassigned noncharacter surrogate pua';
    var key = {
        ArrowUp:    38,
        ArrowDown:  40,
        Enter:      13
    };

    var general_categories_spec = ''
        + "Lu => Uppercase_Letter      => an uppercase letter\n"
        + "Ll => Lowercase_Letter      => a lowercase letter\n"
        + "Lt => Titlecase_Letter      => a digraphic character, with first part uppercase\n"
        + "Lm => Modifier_Letter       => a modifier letter\n"
        + "Lo => Other_Letter          => other letters, including syllables and ideographs\n"
        + "Mn => Nonspacing_Mark       => a nonspacing combining mark (zero advance width)\n"
        + "Mc => Spacing_Mark          => a spacing combining mark (positive advance width)\n"
        + "Me => Enclosing_Mark        => an enclosing combining mark\n"
        + "Nd => Decimal_Number        => a decimal digit\n"
        + "Nl => Letter_Number         => a letterlike numeric character\n"
        + "No => Other_Number          => a numeric character of other type\n"
        + "Pc => Connector_Punctuation => a connecting punctuation mark, like a tie\n"
        + "Pd => Dash_Punctuation      => a dash or hyphen punctuation mark\n"
        + "Ps => Open_Punctuation      => an opening punctuation mark (of a pair)\n"
        + "Pe => Close_Punctuation     => a closing punctuation mark (of a pair)\n"
        + "Pi => Initial_Punctuation   => an initial quotation mark\n"
        + "Pf => Final_Punctuation     => a final quotation mark\n"
        + "Po => Other_Punctuation     => a punctuation mark of other type\n"
        + "Sm => Math_Symbol           => a symbol of mathematical use\n"
        + "Sc => Currency_Symbol       => a currency sign\n"
        + "Sk => Modifier_Symbol       => a non-letterlike modifier symbol\n"
        + "So => Other_Symbol          => a symbol of other type\n"
        + "Zs => Space_Separator       => a space character (of various non-zero widths)\n"
        + "Zl => Line_Separator        => U+2028 LINE SEPARATOR only\n"
        + "Zp => Paragraph_Separator   => U+2029 PARAGRAPH SEPARATOR only\n"
        + "Cc => Control               => a C0 or C1 control code\n"
        + "Cf => Format                => a format control character\n"
        + "Cs => Surrogate             => a surrogate code point\n"
        + "Co => Private_Use           => a private-use character\n"
        + "Cn => Unassigned            => a reserved unassigned code point or a noncharacter\n";


    /* Utility Functions
     * ================= */

    function dec2hex(dec, len) {
        var hex = dec.toString(16).toUpperCase();
        while (hex.length < len) { hex = "0" + hex; }
        return hex;
    }

    function hex2dec(hex) {
        return parseInt(hex, 16);
    }

    function codepoint_to_string(cp, base_char) {
        if(!base_char) {
            base_char = '';
        }
        if(cp < 65536) {
            return base_char + String.fromCharCode(cp);
        }
        var hi = Math.floor((cp - 0x10000) / 0x400) + 0xD800;
        var lo = ((cp - 0x10000) % 0x400) + 0xDC00;
        return base_char + String.fromCharCode(hi) + String.fromCharCode(lo);
    }

    function string_to_codepoint(str) {
        if(str === '') {
            return null;
        }
        var hi = str.charCodeAt(0);
        if((hi & 0xF800) != 0xD800) {
            return hi;
        }
        var lo = str.charCodeAt(1);
        return ((hi - 0xD800) * 0x400) + (lo - 0xDC00) + 0x10000;
    }

    function dec2utf8(dec) {
        if(dec < 0x80) {
            return dec2hex(dec,2);
        }
        if(dec < 0x800) {
            return dec2hex(0xC0 | (dec >> 6), 2) + " "
                + dec2hex(0x80 | (dec & 0x3F), 2);
        }
        if(dec < 0x10000) {
            return dec2hex(0xE0 | (dec >> 12), 2) + " "
                + dec2hex(0x80 | ((dec >> 6)) & 0x3F, 2) + " "
                + dec2hex(0x80 | (dec & 0x3F), 2);
        }
        if(dec < 0x110000) {
            return dec2hex(0xF0 | (dec >> 18), 2) + " "
                + dec2hex(0x80 | ((dec >> 12) & 0x3F), 2) + " "
                + dec2hex(0x80 | ((dec >> 6) & 0x3F), 2) + " "
                + dec2hex(0x80 | (dec & 0x3F), 2);
        }
        return "unknown";
    }

    function utf8hex2dec(str) {
        str = str.toUpperCase().replace(/\s+/g, '');
        if(!str.match(/^(?:[0-9A-F]{2})+$/g)) { return null; }
        var hex = str.match(/([0-9A-F]{2})/g);
        var dec, i, j;
        var bytes = [];
        for(i = 0; i < hex.length; i++) {
            bytes.push(parseInt(hex[i], 16));
        }
        dec = bytes.shift();
        i = 0;
        if(dec > 127) {
            if((dec & 0xE0) === 0xC0) {
                dec = dec & 0x1F;
                i = 1;
            }
            else if((dec & 0xF0) === 0xE0) {
                dec = dec & 0x0F;
                i = 2;
            }
            else if((dec & 0xF8) === 0xF0) {
                dec = dec & 0x07;
                i = 3;
            }
            else if((dec & 0xFC) === 0xF8) {
                dec = dec & 0x03;
                i = 4;
            }
            else {
                return null;
            }
        }
        while(i > 0) {
            if(bytes.length === 0) {
                return null;
            }
            j = bytes.shift();
            if((j & 0xC0) !== 0x80) {
                return null;
            }
            dec = (dec << 6) + (j & 0x3F);
            i--;
        }
        return dec;
    }

    function dec2utf16(dec) {
        if(dec < 0x10000) {
            return dec2hex(dec, 4);
        }
        if (dec < 0x110000) {
            dec = dec - 0x10000;
            return dec2hex(0xD800 | (dec >> 10), 4) + " "
                + dec2hex(0xDC00 | (dec & 0x3FF), 4);
        }
        return "unknown";
    }

    function check_local_storage() {
        try {
            var storage = window.localStorage;
            var test = '__storage_test__';
            storage.setItem(test, test);
            storage.removeItem(test);
            return true;
        }
        catch(e) {
            return false;
        }
    }


    /* UnicodeCharacterFinder Class Definition
     * ======================================= */

    var UnicodeCharacterFinder = function (el, options) {
        this.$el = $(el);
        this.opt = options;
        this.build_ui();
    }

    UnicodeCharacterFinder.prototype = {
        unicode_version:  null,
        code_chart:       { },
        code_list:        [ ],
        reserved_ranges:  [ ],
        code_blocks:      [ ],
        html_entities:    [ ],
        gc:               [ ],
        unique_ids:       [ ],
        max_codepoint:    0,
        scratchpad_mode:  'text',
        local_storage_available: check_local_storage(),

        build_ui: function () {
            this.start_loading_splash(function() {
                this.add_font_dialog();
                this.add_help_dialog();
                this.add_code_chart_dialog();
                this.add_codepoint_dialog();
                this.add_form_elements();
                this.$el.append(this.$form);
                this.load_unicode_data( this.enable_ui ); // callback when done
            });
        },

        start_loading_splash: function (handler) {
            var app = this;
            var $div = this.$splash_dialog = $('<div class="ucf-splash-dlg"/>');
            $div.append(
                $('<p class="ucf-loading">Please wait &#8230; </p>').append(
                    $('<img />')
                        .attr('src', 'images/throbber.gif')
                        .on('load', function() { handler.call(app); })
                )
            ).dialog({
                autoOpen:      true,
                title:         "Loading",
                resizable:     false,
                closeOnEscape: false,
                modal:         true,
                width:         350,
                height:        150
            });
            $div.ajaxError(function(event, req, settings, error) {
                $div.html(
                    '<p class="error">'
                    + '<span class="ui-icon ui-icon-alert"></span>'
                    + 'Failed to load Unicode character data.</p>'
                    + '<p>Have you run <code>make-data-file</code>?</p>'
                );
            });
        },

        enable_ui: function () {
            var app = this;
            $('#unicode-version').text(
                '\u00A0(Version ' + this.unicode_version + ')'
            );
            this.populate_code_blocks_menu();
            this.$splash_dialog.dialog('close');
            this.$el.addClass('ready');
            this.select_codepoint(null);
            this.process_querystring();
            $(window).on('popstate', function() {
                app.select_codepoint(null)
                app.reset_search();
                app.process_querystring();
            });
        },

        process_querystring: function () {
            var args = queryString.parse(location.search);
            // c=U+XXXX
            if(args.c && args.c.match(/^U[ +]([0-9A-Fa-f]{4,7})$/)) {
                this.select_codepoint(hex2dec(RegExp.$1));
            }
            // c=999
            else if(args.c && args.c.match(/^(\d+){1,9}$/)) {
                this.select_codepoint(parseInt(RegExp.$1, 10));
            }
            // c=uXXXXuXXXX
            else if(args.c && args.c.match(/^u([0-9A-Fa-f]{4})u([0-9A-Fa-f]{4})$/)) {
                var str = String.fromCharCode( hex2dec(RegExp.$1) )
                        + String.fromCharCode( hex2dec(RegExp.$2) );
                this.select_codepoint(string_to_codepoint(str));
            }
            // q=????
            else if(args.q) {
                this.$search_input.val(args.q).focus();
                this.trigger_search();
            }
        },

        select_codepoint: function (cp) {
            if(this.curr_cp === cp) {
                return;
            }
            this.curr_cp = cp;
            this.curr_ch = this.lookup_char(cp);
            this.set_character_preview();
            this.show_character_detail();
            this.highlight_code_chart_char();
            this.select_block_name(this.curr_cp);
        },

        set_character_preview: function () {
            var cp = this.curr_cp;
            var ch = this.curr_ch;
            this.$form.removeClass('empty');
            this.$preview_input.removeClass(preview_reset_list);
            if(cp === null) {
                this.$preview_input.val('');
                this.$form.addClass('empty');
                this.$prev_char_btn.button('disable');
                this.$next_char_btn.button('disable');
                this.$add_char_btn.button('disable');
            }
            else {
                this.$prev_char_btn.button('enable');
                this.$next_char_btn.button('enable');
                this.$add_char_btn.button('enable');
                if(ch.reserved) {
                    var str = ch.show ? codepoint_to_string(cp) : '';
                    this.$preview_input.val(str);
                    this.$preview_input.addClass(ch.reserved);
                    if(!ch.show) {
                        this.$add_char_btn.button('disable');
                    }
                }
                else {
                    var base_char = ch.is_cc ? this.opt.combining_base_char : '';
                    var text = codepoint_to_string(cp, base_char);
                    this.$preview_input.val(text);
                }
            }
        },

        lookup_char: function (cp) {
            if(cp === null) {
                return { };
            }
            var hex = dec2hex(cp, 4);
            if(this.code_chart[hex]) {
                return this.code_chart[hex];
            }
            return this.lookup_reserved_char(cp);
        },

        lookup_reserved_char: function (cp) {
            var range = this.lookup_reserved_range(cp);
            if(!range) {
                return null;
            }
            if(range.type === 'templated') {
                var desc = range.template.replace(/#/, hex2dec(cp, 4));
                return {
                    'description':  desc,
                    'cp':           cp
                };
            }
            var ch = {
                'cp':           cp,
                'reserved':     range.type,
                'range_start':  range.first_cp,
                'range_end':    range.last_cp,
            };
            switch(range.type) {
                case 'unassigned':
                    ch.description = "This codepoint is reserved as 'unassigned'";
                    ch.show = true;
                    ch.unassigned = true;
                    break;
                case 'noncharacter':
                    ch.description = "This codepoint is defined as a <noncharacter>";
                    ch.show = false;
                    ch.noncharacter = true;
                    break;
                case 'surrogate':
                    ch.description = "This codepoint is defined as a 'surrogate', it has no meaning unless combined with another codepoint";
                    ch.surrogate = true;
                    ch.show = false;
                    break;
                case 'pua':
                    ch.description = "This codepoint is in a Private Use Area (PUA)";
                    ch.show = true;
                    ch.pua = true;
                    break;
            }
            return ch;
        },

        lookup_reserved_range: function (cp) {
            for(var i = 0; i < this.reserved_ranges.length; i++) {
                if(cp > this.reserved_ranges[i].last_cp){
                    continue;
                }
                if(cp < this.reserved_ranges[i].first_cp){
                    return null;
                }
                return this.reserved_ranges[i];
            }
            return null;
        },

        show_character_detail: function () {
            var cp = this.curr_cp;
            if(cp === null) {
                return;
            }
            var hex   = dec2hex(cp, 4);
            var block = this.block_from_codepoint(cp);
            var ch    = this.curr_ch;
            var gc    = this.gen_cat[ch.gc];
            this.$char_link.attr('href', '?c=U+' + hex);

            var $table = $('<table />').append(
                $('<tr />').append(
                    $('<th />').text('Code point'),
                    $('<td />').append(
                        $('<a />')
                            .addClass('cp-detail')
                            .text('U+' + hex)
                    )
                )
            );
            if(ch && ch.description.length > 0) {
                var $td = $('<td />').text(ch.description);
                if(ch.alias) {
                    $td.append(
                        $('<br />'),
                        $('<span class="alias"/>').text(ch.alias)
                    );
                }
                $table.append(
                    $('<tr />').append( $('<th />').text('Description'), $td )
                );
            }
            if(gc) {
                $table.append(
                    $('<tr />').append(
                        $('<th />').text('Gen. Category').attr('title', 'General Category'),
                        $('<td />').text(gc.category).attr('title', gc.extra)
                    )
                );
            }
            if(!ch.reserved || ch.pua) {
                var entity = '&#' + cp + ';';
                if(ch.entity_name) {
                    entity = entity + ' or &' + ch.entity_name + ';';
                }
                $table.append(
                    $('<tr />').append(
                        $('<th />').text('HTML entity'),
                        $('<td />').text(entity)
                    )
                );
            }
            $table.append(
                $('<tr />').append(
                    $('<th />').text('UTF-8'),
                    $('<td />').text(dec2utf8(cp))
                ),
                $('<tr />').append(
                    $('<th />').text('UTF-16'),
                    $('<td />').text(dec2utf16(cp))
                )
            );
            if(block) {
                var $pdf_link = $('<a />')
                    .text(block.title)
                    .attr('href', block.pdf_url)
                    .attr('title', block.filename + ' at Unicode.org');
                $table.append(
                    $('<tr />').append(
                        $('<th />').text('Character block'),
                        $('<td />').append($pdf_link)
                    )
                );
            }
            this.$char_info.empty().append($table);
        },

        check_preview_input: function (click_only) {
            var str = this.$preview_input.val();
            var len = str.length;
            if(len === 0) {
                if(click_only) {
                    return;
                }
                this.select_codepoint(null);
            }
            if(len > 1) {
                if((str.charCodeAt(len - 2) & 0xF800) === 0xD800) {
                    str = str.substr(len - 2, 2);
                }
                else {
                    str = str.substr(len - 1, 1);
                }
                this.$preview_input.val(str);
            }
            this.select_codepoint(string_to_codepoint(str));
        },

        add_font_dialog: function () {
            var app = this;
            var $font_tab = $('<div class="ucf-tab-font" />');
            this.$el.append($font_tab);

            var $form = $('<form class="ucf-font-menu" />');
            this.$font_dialog = $form;
            $form.attr('id', this.$el.data('font_dlg_id'));
            var $inp = $('<input type="text" class="ucf-font" />')
                .css({'width': '320px'})
                .autocomplete({
                    source: this.opt.font_list
                });
            $form.append(
                $('<p />').text(
                    'Select the font used in the main character preview box ' +
                    'and in the code chart window.'
                ),
                $('<p />').text(
                    'Note: not all characters are available in all fonts.'
                ),
                $('<label>Font name</label>'),
                $inp
            );

            $form.dialog({
                autoOpen:      false,
                title:         "Font Selection",
                resizable:     true,
                closeOnEscape: true,
                width:         360,
                height:        250,
                buttons:       {
                    "Save":  function() {
                        app.save_font($inp.val());
                        $form.dialog("close");
                    },
                    "Cancel": function() { $(this).dialog("close"); }
                }
            }).submit(function(e) {
                e.preventDefault();
                app.save_font($inp.val());
                $form.dialog("close");
            });

            $font_tab.click(function() { $form.dialog('open'); });
        },

        add_help_dialog: function () {
            var sel = this.opt.help_selector;
            if(sel) {
                var $div = $(sel);
                if($div.length > 0) {
                    var $help_tab = $('<div class="ucf-tab-help" />');
                    $div.dialog({
                        autoOpen:      false,
                        title:         "Using the Unicode Character Finder",
                        resizable:     true,
                        closeOnEscape: true,
                        modal:         true,
                        width:         700,
                        height:        400,
                        buttons:       {
                            "Close": function() { $(this).dialog("close"); }
                        }
                    });
                    $help_tab.click(function() {
                        $div.dialog('open');
                        $(sel).scrollTop(0)
                    });
                    this.$el.append($help_tab);
                }
            }
        },

        scratchpad_pane: function () {
            var app = this;
            this.$scratchpad_textarea = $('<textarea />')
                .addClass('needs-font')
                .prop('placeholder', 'Add characters here to save them for later')
                .prop('spellcheck', false);
            if(this.local_storage_available) {
                this.$scratchpad_textarea
                    .val(window.localStorage.ucf_scratchpad || '')
                    .on('change', function () {
                        window.localStorage.ucf_scratchpad = $(this).val();
                    });
            }
            this.$scratchpad_cp_list = $('<ul />')
                .on('dblclick', 'li', function() {
                    var cp_hex = $(this).attr('data-cp');
                    app.select_codepoint(hex2dec(cp_hex));
                })
                .sortable({
                    appendTo: document.body,
                    update: function () { app.set_scratchpad_text_from_codepoints(); }
                });
            this.$scratchpad_wrap = $('<div />').addClass('scratchpad-wrap text-mode').append(
                $('<div />').addClass('scratchpad').append(
                    $('<ul />').addClass('scratchpad-mode ui-widget').append(
                        $('<li />').append(
                            $('<label />').append(
                                $('<input type="radio" name="scratchpad_mode" value="text" checked />'),
                                'Text'
                            )
                        ).click(function() { app.toggle_scratchpad_mode('text') }),
                        $('<li />').append(
                            $('<label />').append(
                                $('<input type="radio" name="scratchpad_mode" value="cp" />'),
                                'Codepoints'
                            )
                        ).click(function() { app.toggle_scratchpad_mode('cp') }),
                        this.build_scratchpad_menu()
                    ),
                    this.$scratchpad_textarea,
                    $('<div />').addClass('codepoints needs-font').append(
                        this.$scratchpad_cp_list
                    )
                ),
                $('<a />').addClass('handle').text('Scratchpad').click(function () {
                    app.toggle_open_scratchpad();
                })
            );
            return this.$scratchpad_wrap;
        },

        build_scratchpad_menu: function () {
            var app = this;
            var menu_button = $('<li />').append(
                $('<button />').addClass('menu-button').text('\u2630')
            );

            var $menu = $('<ul />')
                .addClass('scratchpad-menu')
                .append(
                    $('<li />').text('Clear scratchpad').data('item', 'clear'),
                    $('<li />').text('Normalise to NFC (Composed)').data('item', 'to_nfc'),
                    $('<li />').text('Normalise to NFD (Decomposed)').data('item', 'to_nfd')
                )
                .menu({
                    select: function(e, ui) {
                        $menu.hide();
                        var method = 'scratchpad_menu_' + ui.item.data('item');
                        if(app[method]) {
                            app[method].apply(app);
                        }
                    }
                }).hide();
            $('body').append($menu).on('click', function() { $menu.hide();} );

            return menu_button.on('click', function(e) {
                e.stopPropagation();
                $menu.show().position(
                    { my: "right top", at: "right botton", of: menu_button}
                );
            });
        },

        scratchpad_menu_clear: function () {
            this.$scratchpad_textarea.val('').change();
            if(this.scratchpad_mode === 'cp') {
                this.set_scratchpad_codepoints_from_text();
            }
        },

        scratchpad_menu_to_nfc: function () {
            var text = this.$scratchpad_textarea.val().normalize('NFC');
            this.$scratchpad_textarea.val(text);
            if(this.scratchpad_mode === 'cp') {
                this.set_scratchpad_codepoints_from_text();
            }
        },

        scratchpad_menu_to_nfd: function () {
            var text = this.$scratchpad_textarea.val().normalize('NFD');
            this.$scratchpad_textarea.val(text);
            if(this.scratchpad_mode === 'cp') {
                this.set_scratchpad_codepoints_from_text();
            }
        },

        toggle_open_scratchpad: function () {
            if(this.$scratchpad_wrap.hasClass('open')) {
                this.close_scratchpad();
            }
            else {
                this.open_scratchpad();
            }
        },

        open_scratchpad: function () {
            if(!this.$scratchpad_wrap.hasClass('open')) {
                if(this.scratchpad_mode === 'text') {
                    // sync state with UI after browser tab restore
                    this.$scratchpad_wrap.find('input[name=scratchpad_mode][value=text]').prop('checked', true);
                }
                this.$scratchpad_wrap.addClass('open')
                    .find('.scratchpad').slideDown('fast');
            }
        },

        close_scratchpad: function () {
            if(this.$scratchpad_wrap.hasClass('open')) {
                this.$scratchpad_wrap.removeClass('open')
                    .find('.scratchpad').slideUp('fast');
            }
        },

        toggle_scratchpad_mode: function (new_mode) {
            if(this.scratchpad_mode === new_mode) {
                return;
            }
            if(new_mode === 'text') {
                this.set_scratchpad_text_from_codepoints();
                this.$scratchpad_wrap.removeClass('cp-mode').addClass('text-mode');
            }
            else {
                this.set_scratchpad_codepoints_from_text();
                this.$scratchpad_wrap.removeClass('text-mode').addClass('cp-mode');
            }
            this.scratchpad_mode = new_mode;
        },

        set_scratchpad_codepoints_from_text: function () {
            this.$scratchpad_cp_list.empty();
            var text = this.$scratchpad_textarea.val();
            for(var i = 0; i < text.length; i++) {
                var cp = string_to_codepoint(text.substr(i, 2));
                if((text.charCodeAt(i) & 0xF800) === 0xD800) {  // skip the 2nd half of a surrogate pair
                    i++;
                }
                this.append_scratchpad_codepoint(cp);
            }
        },

        set_scratchpad_text_from_codepoints: function () {
            var text = '';
            this.$scratchpad_cp_list.find('li span').each(function(i, el) {
                var $el = $(el);
                var char_text = $el.text();
                if($el.parent().hasClass('combining-char')) {
                    char_text = char_text.slice(1);
                }
                text += char_text;
            });
            this.$scratchpad_textarea.val(text).change();
        },

        append_scratchpad_codepoint: function (cp) {
            var hex_cp = dec2hex(cp, 4);
            var ch = this.lookup_char(cp);
            var base_char = ch.is_cc ? this.opt.combining_base_char : '';
            var text = codepoint_to_string(cp, base_char);
            var $cp = $('<li />').attr('data-cp', hex_cp).append(
                $('<span />').text(text)
            );
            if(ch.is_cc) {
                $cp.addClass('combining-char');
            }
            if(ch && ch.description) {
                var title = ch.description;
                if(ch.alias) {
                    title += ' ' + ch.alias;
                }
                if(title.length > 30) {
                    title = title.substr(0, 60).replace(/( \S+)?$/, '\u2026');
                }
                $cp.attr('title', title);
            }
            this.$scratchpad_cp_list.append($cp);
        },

        add_current_char_to_scratchpad: function () {
            this.open_scratchpad();
            if(this.curr_cp === null) {
                return;
            }
            if(this.scratchpad_mode === 'text') {
                var text = this.$scratchpad_textarea.val()
                         + codepoint_to_string(this.curr_cp);
                this.$scratchpad_textarea.val(text).change();
            }
            else {
                this.append_scratchpad_codepoint(this.curr_cp);
                this.set_scratchpad_text_from_codepoints();
            }
        },

        char_search_field: function () {
            this.$search_wrapper = $('<div />').addClass("search-wrap state-empty")
                .append(
                    $('<label />').text('Search character descriptions:'),
                    this.build_search_link(),
                    this.build_search_reset(),
                    this.build_search_input(),
                    this.build_search_results()
                );
            this.add_sample_chars()
            this.init_search_input();
            return this.$search_wrapper;
        },

        build_search_link: function () {
            var app = this;
            return this.$search_link =
                $('<a class="search-link" title="Link to this search" >&#167;</a>')
                    .click(function(e) { app.push_to_link(e, this.href); });
        },

        push_to_link: function (e, url) {
            window.history.pushState({}, this.opt.title, url);
            e.preventDefault();
        },

        build_search_reset: function () {
            var app = this;
            return $('<span>&#9003;</span>')
                .addClass("search-reset ui-widget")
                .attr('title', 'Clear the current search')
                .click(function () {
                    app.reset_search();
                });
        },

        build_search_input: function () {
            return this.$search_input = $('<input type="text" />')
                .addClass("search ui-autocomplete-input");
        },

        build_search_results: function () {
            var app = this;
            this.$search_results =
                $('<ul />').addClass('result-items ui-autocomplete ui-menu  ui-widget ui-widget-content')
                    .on('click', 'li', function() {
                        app.select_search_item(this);
                    });
            var $div = $('<div />').addClass('search-results').append(
                this.$search_results,
                $('<div />').addClass('search-footer ui-widget').append(
                    $('<span />').addClass('throbber').text('Searching ...'),
                    $('<span />').addClass('partial').text('More ...'),
                    $('<span />').addClass('complete').text('Search complete')
                ).click(function() {
                    app.find_more_results();
                })
            );
            $(window).on('scroll', function() {
                if(app.scroll_trigger_point && $(document).scrollTop() > app.scroll_trigger_point) {
                    app.find_more_results();
                }
            });
            $(window).on('resize', function() {
                app.set_scroll_trigger();
            });
            return $div;
        },

        set_scroll_trigger: function () {
            this.scroll_trigger_point = $(document).height() - $(window).height() - this.opt.scroll_trigger_zone;
        },

        init_search_input: function () {
            var app = this;
            this.$search_input.on(
                "keydown keypress input paste",
                function(e) {
                    if(!app.handle_search_cursor_keys(e)) {
                        app.trigger_search();
                    }
                }
            );
        },

        reset_search: function () {
            this.search = null;
            this.clear_search_results();
            this.$search_input.val('').focus();
            this.set_search_state('empty');
        },

        clear_search_results: function () {
            this.$search_results.empty();
        },

        handle_search_cursor_keys: function (e) {
            if(e.type !== 'keydown') { return false; }
            var $li = this.$search_results.find('li.selected');
            if($li.length === 0) {
                $li = null;
            }
            if(e.which === key.ArrowDown) {
                if($li) {
                    $li = $li.next();
                }
                else {
                    $li = this.$search_results.find('li:nth-child(1)');
                }
            }
            else if(e.which === key.ArrowUp) {
                if($li) {
                    $li = $li.prev();
                }
            }
            else if(e.which === key.Enter) {
                if($li) {
                    this.select_search_item($li);
                }
            }
            else {
                return false;
            }
            e.preventDefault();
            if($li && $li.length > 0) {
                this.$search_results.find('li.selected').removeClass('selected');
                $li.addClass('selected');
            }
            return true;
        },

        trigger_search: function () {
            var app = this;
            this.set_search_link();
            if(app.search_pending) {
                clearTimeout(app.search_pending);
            }
            app.search_pending = setTimeout(
                function() {
                    delete app.search_pending;
                    app.start_search();
                },
                this.opt.search_delay || 800
            );
        },

        start_search: function () {
            var query = this.$search_input.val();
            if(this.search && this.search.query === query) {
                return;
            }
            this.clear_search_results();
            if(query === '') {
                this.set_search_state('empty');
                delete this.search;
                return;
            }
            this.search = {
                "query":  query,
                "index":  0,
                "seen":   {}
            };
            if(query.charAt(0) === '/') {
                if(query.length < 3 || query.charAt(query.length - 1) !== '/') {
                    return;
                }
                query = query.substr(1, query.length - 2);
                this.search.regex = new RegExp(query, 'i');
                this.search.exact_matches = [];
            }
            else {
                this.search.uquery = query.toUpperCase();
                this.search.exact_matches = this.exact_matches();
            }
            this.find_more_results();
        },

        find_more_results: function () {
            if(!this.search) {
                return;
            }
            if(this.search.done) {
                this.set_search_state('complete');
                return;
            }
            this.set_search_state('searching');
            var max_height = $(document).height() + $(window).height() - this.opt.scroll_trigger_zone * 2;
            for(var i = 0; i < 30; i++) {
                var ch = this.next_match();
                if(!ch) {
                    break;
                }
                var character = codepoint_to_string(ch.cp);
                var code = dec2hex(ch.cp, 4);
                var $desc = $('<div />').addClass('code-descr').text(ch.description);
                if(ch.alias) {
                    $desc.append( $('<span class="code-alias" />').text(ch.alias) );
                }
                if(ch.prefix) {
                    $desc.prepend( $('<span class="prefix" />').text(ch.prefix) );
                }
                var $sample = $('<div />').addClass('code-sample needs-font').text("\u00A0" + character);
                if(this.current_font) {
                    $sample.css({'fontFamily': this.current_font});
                }
                this.$search_results.append(
                    $('<li>').addClass('ui-menu-item').attr('role', 'menuitem')
                        .data('codepoint', ch.cp)
                        .append(
                            $('<div />').addClass('code-point').text('U+' + code),
                            $sample,
                            $desc
                        )
                );
                if($(document).height() >= max_height) {
                    break;
                }
            }
            this.set_scroll_trigger();
            if(this.search.done) {
                this.set_search_state('complete');
            }
            else {
                this.set_search_state('partial');
            }
        },

        next_match: function () {
            var s = this.search;
            var m, code, ch, prefix;
            if(s.exact_matches.length > 0) {
                m = s.exact_matches.shift();
                prefix =  m[1] === '' ? '' : '[' + m[1] + '] ';
                ch = $.extend({}, m[0], {'prefix': prefix});
                s.seen[ch.cp] = true;
                return ch;
            }
            while(s.index < this.code_list.length) {
                code = this.code_list[s.index];
                ch   = this.code_chart[code];
                s.index++;
                if(s.seen[ch.cp]) {
                    continue;
                }
                if(s.regex) {
                    if(
                        s.regex.test(ch.description)
                        || (ch.alias && s.regex.test(ch.alias))
                    ) {
                        return ch;
                    }
                }
                else {
                    if(
                        ch.description.indexOf(s.uquery) >= 0
                        || (ch.alias && ch.alias.indexOf(s.uquery) >= 0)
                    ) {
                        return ch;
                    }
                }
            }
            s.done = true;
            return null;
        },

        exact_matches: function () {
            var cp, hex, ch;
            var matches = [];
            var query = this.search.query;
            var uquery = this.search.uquery;
            if(query.match(/^&#(\d+);?$/) || query.match(/^(\d+)$/)) {
                cp = parseInt(RegExp.$1, 10);
                ch = this.lookup_char(cp);
                if(ch) {
                    matches.push([ch, 'Decimal: ' + cp]);
                }
            }
            if(query.match(/^&#x([0-9a-f]+);?$/i) || query.match(/^(?:U[+])?([0-9a-f]+)$/i)) {
                cp = hex2dec(RegExp.$1);
                ch = this.lookup_char(cp);
                if(ch) {
                    matches.push([ch, '']);
                }
            }
            cp = utf8hex2dec(query);
            if(cp && cp > 127) {
                ch = this.lookup_char(cp);
                if(ch) {
                    matches.push([ch, 'UTF8 Hex: ' + dec2utf8(cp)]);
                }
            }
            if(query.match(/^(?:&#?)?(\w+);?$/)) {
                query = RegExp.$1;
            }
            for(var i = 0; i < this.html_entities.length; i++) {
                var ent = this.html_entities[i];
                if(ent.name === query) {
                    matches.unshift([this.lookup_char(ent.cp), '&' + ent.name + ';']);
                }
                else if(ent.uname === uquery) {
                    matches.push([this.lookup_char(ent.cp), '&' + ent.name + ';']);
                }
            }

            return matches;
        },

        select_search_item: function (item) {
            var $item = $(item);
            this.select_codepoint( $item.data('codepoint') );
            this.$search_results.find('li.selected').removeClass('selected');
            $item.addClass('selected');
            window.scrollTo(0,0);
            this.$search_input.focus();
        },

        set_search_link: function () {
            var str = this.$search_input.val();
            var link = '?' + queryString.stringify({ q: str });
            this.$search_link.attr('href', link);
        },

        set_search_state: function (state) {
            this.$search_wrapper.removeClass('state-empty state-searching state-partial state-complete');
            this.$search_wrapper.addClass('state-' + state);
        },

        add_form_elements: function () {
            this.$form = $('<form class="ucf-app empty" />').append(
                this.char_info_pane(),
                this.scratchpad_pane(),
                this.char_search_field()
            ).submit(function(event) {
                event.preventDefault();
            });
        },

        char_info_pane: function () {
            return $('<div class="char-wrap"></div>').append(
                this.build_char_preview_pane(),
                this.build_char_details_pane()
            );
        },

        build_char_preview_pane: function () {
            return $('<div class="char-preview"></div>').append(
                $('<div class="char-preview-label">Character<br />Preview</div>'),
                this.build_preview_input(),
                this.build_char_buttons()
            );
        },

        build_preview_input: function () {
            var app = this;
            var cb1 = function() { app.check_preview_input(); };
            var cb2 = function() { app.check_preview_input(true); };
            return this.$preview_input =
                $('<input type="text" class="char needs-font" title="Type or paste a character" />')
                .change( cb1 )
                .keypress(function() { setTimeout(cb1, 50); })
                .mouseup(function() { setTimeout(cb2, 50); })
                .mousewheel(function(event, delta) {
                    app.scroll_char(event, delta);
                    event.preventDefault();
                });
        },

        build_char_buttons: function () {
            var app = this;
            this.$prev_char_btn =
                $('<button class="char-prev" title="Previous character" />')
                    .text('Prev')
                    .button({ icons: { primary: 'ui-icon-circle-triangle-w' } })
                    .click(function() { app.increment_code_point(-1); });
            this.$char_menu_btn =
                $('<button class="char-menu" title="Show code chart" />')
                    .text('Chart')
                    .button({ icons: { primary: 'ui-icon-calculator' } })
                    .click(function() { app.display_chart_dialog(); });
            this.$next_char_btn =
                $('<button class="char-next" title="Next character" />')
                    .text('Next')
                    .button({ icons: { primary: 'ui-icon-circle-triangle-e' } })
                    .click(function() { app.increment_code_point(1); });
            this.$add_char_btn =
                $('<button class="char-add" title="Add to scratchpad" />')
                    .text('Add')
                    .button({ icons: { primary: 'ui-icon-circle-arrow-s' } })
                    .click(function() { app.add_current_char_to_scratchpad(); });
            this.$char_link =
                $('<a class="char-link" title="Link to this character" />')
                    .html('&#167;')
                    .click(function(e) { app.push_to_link(e, this.href); });
            return $('<span class="char-buttons" />').append(
                this.$prev_char_btn,
                this.$char_menu_btn,
                this.$next_char_btn,
                this.$add_char_btn,
                this.$char_link
            );
        },

        add_sample_chars: function () {
            if(this.opt.sample_chars) {
                this.$search_wrapper.append( this.sample_char_links() );
            }
        },

        sample_char_links: function () {
            var app = this;
            var chars = this.opt.sample_chars;

            var $div = $(
                '<div class="sample-wrap" title="click character to select">'
                + 'Examples &#8230; </div>'
            );

            var $list = $('<ul></ul>');
            for(var i = 0; i < chars.length; i++) {
                $list.append(
                    $('<li></li>').text(codepoint_to_string(chars[i]))
                );
            }
            $div.append($list);

            $list.find('li').click(function () {
                app.select_codepoint(string_to_codepoint( $(this).text() ));
            });
            return $div;
        },

        add_code_chart_dialog: function () {
            var app = this;
            this.$chart_dialog = $('<div class="ucf-chart-dialog" />').append(
                this.build_code_chart_table(),
                this.build_code_chart_buttons()
            )
            .dialog({
                autoOpen:      false,
                title:         "Unicode Character Chart",
                resizable:     false,
                closeOnEscape: true,
                width:         580,
                height:        330,
            })
            .dialog( "option", "position", { my: "center center", at: "center center", of: "body" } );
        },

        build_code_chart_table: function () {
            var app = this;
            this.$code_chart_table = $('<table class="ucf-code-chart" />')
                .delegate('td', 'click', function() { app.code_chart_click(this); })
                .mousewheel(function(event, delta) {
                    app.increment_chart_page(-1 * delta)
                    event.preventDefault();
                });
            return $('<div class="ucf-chart-wrapper" />')
                .append(this.$code_chart_table);
        },

        build_code_chart_buttons: function () {
            var app = this;
            return $('<div class="ucf-chart-buttons" />').append(
                $('<button>').text('Close').button({
                    icons: { primary: 'ui-icon-circle-close' }
                }).click( function() {
                    app.$chart_dialog.dialog("close");
                }),
                $('<button>').text('Next').button({
                    icons: { primary: 'ui-icon-circle-triangle-e' }
                }).click( function() {
                    app.increment_chart_page(1);
                }),
                $('<button>').text('Prev').button({
                    icons: { primary: 'ui-icon-circle-triangle-w' }
                }).click( function() {
                    app.increment_chart_page(-1);
                }),
                this.build_blocks_menu()
            );
        },

        build_blocks_menu: function () {
            var app = this;
            return this.$blocks_menu = $('<select class="ucf-block-menu">')
                .change(function() {
                    var block = app.code_blocks[$(this).val()];
                    var code_base = block.start_dec & block_mask;
                    app.set_code_chart_page(code_base);
                });
        },

        add_codepoint_dialog: function () {
            var app = this;
            this.$cp_dialog = $('<div class="ucf-cp-dialog" />')
            .dialog({
                autoOpen:      false,
                title:         "Character detail from codepoints.net",
                resizable:     true,
                closeOnEscape: true,
                width:         620,
                height:        $(window).height() - 80
            })
            .dialog( "option", "position", { my: "center center", at: "center center", of: "body" } );
            $.ajax({
                url: './cpp.json',
                type: 'GET',
                dataType: 'json',
            }).then(function(prop_list) {
                app.codepoint_properties = prop_list;
            });
        },

        show_codepoint_dialog: function () {
            var app = this
            this.$cp_dialog.empty().append(
                $('<p />').addClass('ucf-loading')
                    .text('Loading details from codepoints.net \u2026 ')
                    .css({marginTop: '30px'})
                    .append(
                        $('<img />').attr('src', 'images/throbber.gif')
                    )
            ).dialog('open');
            var cp = this.curr_cp;
            var cp_hex = dec2hex(cp, 4);
            var api_url = 'http://codepoints.net/api/v1/codepoint/' + cp_hex;
            $.ajax({
                url: api_url,
                type: 'GET',
                dataType: 'json',
            }).then(function(cp_prop) {
                app.populate_codepoint_dialog(cp_prop);
            });
        },

        populate_codepoint_dialog: function (cp_prop) {
            var $out = this.$cp_dialog.empty();
            var cp = parseInt(cp_prop.cp, 10);
            var char = codepoint_to_string(cp);
            var cp_hex = dec2hex(cp, 4);
            var cp_url = 'https://codepoints.net/U+' + cp_hex;
            $out.append(
                $('<p />').addClass('cp-link').append(
                    $('<a />').attr({href: cp_url, target: '_blank'}).text(cp_url)
                )
            );
            if(cp_prop.image) {
                $out.append(
                    $('<img />').addClass('cp-image')
                        .attr('src', 'data:image/png;base64,' + cp_prop.image)
                );
            }
            if(cp_prop.abstract) {
                $out.append(
                    $('<div />').addClass('abstract').html(cp_prop.abstract)
                );
            }
            var $table = $('<table />').addClass('cp-properties').append(
                $('<tr />').append(
                    $('<th />').text('Property'),
                    $('<th />').text('Value')
                )
            );
            $(this.codepoint_properties).each(function(i, prop) {
                var name = prop.property;
                if(cp_prop.hasOwnProperty(name)) {
                    var $name = $('<td />').text(prop.title).append(
                        $('<span />').addClass('prop-name')
                            .text(' (' + name + ')')
                    );
                    var $value = $('<td />');
                    var val = cp_prop[name];
                    if(prop.boolean) {
                        if(val === "1") {
                            $value.addClass('boolean-true').text('\u2714');
                        }
                        else {
                            $value.addClass('boolean-false').text('\u2717');
                        }
                    }
                    else if(typeof val === 'object') {
                        $value.append(
                            $('<span />').addClass('cp-hex').text('U+' + cp_hex),
                            char
                        );
                    }
                    else {
                        if(prop.map && prop.map[val]) {
                            val = prop.map[val];
                        }
                        $value.text(val);
                    }
                    $table.append( $('<tr />').append($name, $value) );
                }
            });
            $out.append($table);
        },

        build_char_details_pane: function () {
            var app = this;
            this.$char_info = $('<div class="char-info"></div>')
                .on('click', '.cp-detail', function() {
                    app.show_codepoint_dialog();
                });
            return $('<div class="char-props"></div>').append(
                $('<div class="char-props-label">Character<br />Properties</div>'),
                this.$char_info
            );
        },

        populate_code_blocks_menu: function () {
            for(var i = 0; i < this.code_blocks.length; i++) {
                this.$blocks_menu.append(
                    $('<option>').text(
                        this.code_blocks[i].start + ' ' + this.code_blocks[i].title
                    ).attr('value', i)
                );
            }
        },

        increment_code_point: function (inc) {
            var cp = this.curr_cp + inc;
            if(cp === -1) {
                this.select_codepoint(null);
                return;
            }
            var ch = this.lookup_char(cp);
            if(!ch.reserved || ch.show) {
                this.select_codepoint(cp);
                return;
            };
            if(ch.reserved) {
                // recurse to handle adjacent reserved blocks
                this.curr_cp = (inc < 0 ? ch.range_start : ch.range_end);
                return this.increment_code_point(inc);
            }
        },

        scroll_char: function (event, delta) {
            if(!event.ctrlKey) {
                this.increment_code_point(delta < 0 ? 1 : -1);
                return;
            }
            var code = this.curr_cp || 0;
            var block = this.block_from_codepoint(code);
            var i = block.index + (delta < 0 ? 1 : -1);
            if(!this.code_blocks[i]) { return; }
            this.select_codepoint(this.code_blocks[i].start_dec);
        },

        display_chart_dialog: function () {
            window.scrollTo(0,0);
            var rect = this.$el[0].getBoundingClientRect();
            this.set_code_chart_page(this.curr_cp);
            this.$chart_dialog
                .dialog('option', 'position', [rect.left - 1, 248])
                .dialog('open');
        },

        set_code_chart_page: function (base_code) {
            base_code = base_code & block_mask;
            if(this.code_chart_base === base_code) {
                return;
            }
            this.code_chart_base = base_code;

            var $dlg = this.$chart_dialog
            $dlg.dialog('option', 'title', 'Unicode Character Chart '
                + dec2hex(base_code, 4) + ' - ' + dec2hex(base_code + 0x7F, 4)
            );

            var $tbody = $('<tbody />');
            var i, j, $row, $cell, meta;
            var cp = base_code;
            for(i = 0; i < 8; i++) {
                $row = $('<tr />');
                for(j = 0; j < 16; j++) {
                    $cell = $('<td />');
                    var ch = this.lookup_char(cp);
                    var show_char = true;
                    var char_class = null;
                    if(!ch) {
                        char_class = 'unassigned';
                    }
                    else if(ch.reserved) {
                        char_class = ch.reserved;
                        show_char  = ch.show;
                    }
                    if(char_class) {
                        $cell.addClass(char_class);
                    }
                    if(show_char) {
                        $cell.text(codepoint_to_string(cp));
                    }
                    if(ch.description) {
                        $cell.attr('title', ch.description);
                    }
                    $row.append($cell);
                    cp++;
                }
                $tbody.append($row);
            }
            this.$code_chart_table.empty().append($tbody);
            if((this.curr_cp & block_mask) === base_code) {
                this.select_block_name(this.curr_cp);
            }
            else {
                this.select_block_name(base_code);
            }
        },

        highlight_code_chart_char: function () {
            this.set_code_chart_page(this.curr_cp, true);
            if(this.curr_cp !== null) {
                this.$code_chart_table.find('td').removeClass('curr-char');
                var col = (this.curr_cp & 15) + 1;
                var row = ((this.curr_cp >> 4) & 7) + 1;
                var selector = 'tr:nth-child(' + row + ') td:nth-child(' + col + ')';
                this.$code_chart_table.find(selector).addClass('curr-char');
            }
        },

        select_block_name: function (cp) {
            var block = this.block_from_codepoint(cp);
            if(block && this.$blocks_menu.val() !== block.index) {
                this.$blocks_menu.val(block.index);
            }
        },

        code_chart_click: function (td) {
            var $td = $(td);
            var col = $td.prevAll().length;
            var row = $td.parent().prevAll().length;
            this.select_codepoint(this.code_chart_base + row * 16 + col);
        },

        increment_chart_page: function (incr) {
            var code_base = this.code_chart_base;
            if(incr < 0  &&  code_base === 0) {
                return;
            }
            code_base = code_base + (incr * 128);
            this.set_code_chart_page(code_base, true);
            if((this.curr_cp & block_mask) === code_base) {
                this.highlight_code_chart_char();
            }
        },

        save_font: function (new_font) {
            this.current_font = new_font;
            this.$el.find('.needs-font').css({'fontFamily': new_font});
            this.$code_chart_table.css({'fontFamily': new_font});
        },

        load_unicode_data: function (handler) {
            var app = this;
            var data_url = this.opt.data_file_no_unihan;
            $.get(data_url, null, function(data, status) {
                app.parse_unicode_data(data, status, handler);
            }, 'text' );
            this.load_general_categories();
        },

        load_general_categories: function () {
            var gen_cat = [];
            general_categories_spec.split("\n").forEach(function(line) {
                var part = line.split(/\s+=>\s+/);
                if(part.length === 3) {
                    gen_cat.push({
                        code:     part[0],
                        category: part[1],
                        extra:    part[2]
                    });
                }
            });
            this.gen_cat = gen_cat;
        },

        parse_unicode_data: function (data, status, handler) {
            var i = 0;
            var j, str, line, field, offset, type, code, ent_name, range_end, block;
            var curr_cp = 0;
            var gc_code_offset = string_to_codepoint('0');
            var curr_gc;
            while(i < data.length) {
                j = data.indexOf("\n", i);
                if(j < 1) { break; }
                line = data.substring(i, j);
                field = line.split("\t");

                // First line is version or 'description' of Unicode source
                if(this.unicode_version === null) {
                    this.unicode_version = line;
                }

                // [ line describes a block
                else if(line[0] === '[') {
                    field[0] = field[0].replace(/^\[/, '');
                    block = {
                        'start'    : field[0],
                        'end'      : field[1],
                        'start_dec': hex2dec(field[0]),
                        'end_dec'  : hex2dec(field[1]),
                        'title'    : field[2],
                        'filename' : field[3],
                        'pdf_url'  : field[4],
                        'index'    : this.code_blocks.length
                    };
                    this.code_blocks.push(block);
                }

                // There may be an offset before the type prefix on these lines
                else {
                    offset = 1;
                    if(field[0].match(/^[+](\d+)/)) {
                        offset = parseInt(RegExp.$1, 10);
                        field[0] = field[0].replace(/^[+]\d+/, '');
                    }
                    curr_cp += offset;
                    if(curr_cp > this.max_codepoint) {
                        this.max_codepoint = curr_cp;
                    }
                    code = dec2hex(curr_cp, 4);

                    type = '"';
                    if(field[0].match(/^(["#%^!*])/)) {
                        type = RegExp.$1;
                        field[0] = field[0].replace(/^["#%^!*]/, '');
                    }

                    switch(type) {

                        // " line describes a character
                        case '"':
                            var desc = field[0];
                            // A prefix of '>x' indicates 'General Category' 'x'
                            if(desc[0] === '>') {
                                curr_gc = string_to_codepoint(desc[1]) - gc_code_offset;
                                desc = desc.slice(2);
                            }
                            // Initial letter of desc will be lowercase if it's a combining char
                            var is_cc = (desc[0] === desc[0].toLowerCase() && desc[0] !== desc[0].toUpperCase());
                            desc = desc.replace(/^./, desc[0].toUpperCase());
                            this.code_chart[code] = {
                                description:  desc,
                                cp:           curr_cp,
                                gc:           curr_gc
                            };
                            if(is_cc) {
                                this.code_chart[code].is_cc = true;
                            }
                            if(field[1] && field[1].match(/^&(\w+);/)) {
                                var ent_name = RegExp.$1;
                                this.html_entities.push({
                                    'name':   ent_name,
                                    'uname':  ent_name.toUpperCase(),
                                    'cp':     curr_cp
                                });
                                this.code_chart[code].entity_name = ent_name;
                                field[1] = field[1].replace(/^&\w+;/, '')
                            }
                            if(field[1] && field[1].length > 0) {
                                this.code_chart[code].alias = field[1];
                            }
                            this.code_list.push(code);
                            break;

                        // % line describes a reserved range
                        case '%':
                            range_end = curr_cp + parseInt(field[0], 10) - 1;
                            this.reserved_ranges.push({
                                type:     'unassigned',
                                first_cp: curr_cp,
                                last_cp:  range_end
                            });
                            curr_cp = range_end;
                            break;

                        // # line describes a templated character range
                        case '#':
                            range_end = curr_cp + parseInt(field[0], 10) - 1;
                            this.reserved_ranges.push({
                                type:     'templated',
                                first_cp: curr_cp,
                                last_cp:  range_end,
                                template: field[1]
                            });
                            curr_cp = range_end;
                            break;

                        // # line describes a surrogate codepoint range
                        case '^':
                            range_end = curr_cp + parseInt(field[0], 10) - 1;
                            this.reserved_ranges.push({
                                type:     'surrogate',
                                first_cp: curr_cp,
                                last_cp:  range_end
                            });
                            curr_cp = range_end;
                            break;

                        // * line describes a private use range (PUA)
                        case '*':
                            range_end = curr_cp + parseInt(field[0], 10) - 1;
                            this.reserved_ranges.push({
                                type:     'pua',
                                first_cp: curr_cp,
                                last_cp:  range_end
                            });
                            curr_cp = range_end;
                            break;

                        // ! line describes a non-character
                        case '!':
                            range_end = curr_cp + parseInt(field[0], 10) - 1;
                            this.reserved_ranges.push({
                                type:     'noncharacter',
                                first_cp: curr_cp,
                                last_cp:  range_end
                            });
                            curr_cp = range_end;
                            break;

                        default:
                            throw "No handler for type: '" + type + "'";
                    }
                }
                i = j + 1;
            }
            handler.call(this);
        },

        block_from_codepoint: function (cp) {
            for(var i = 0; i < this.code_blocks.length; i++) {
                if(cp > this.code_blocks[i].end_dec){
                    continue;
                }
                if(cp < this.code_blocks[i].start_dec){
                    return null;
                }
                return this.code_blocks[i];
            }
            return null;
        }

    };


    /* UnicodeCharacterFinder Plugin Definition
     * ======================================== */

    $.fn.ucf = function(options) {
        options = $.extend($.fn.ucf.defaults, options);

        return this.each(function(x) {
            var app = new UnicodeCharacterFinder(this, options);
            $(this).data('UnicodeCharacterFinder', app);
        });
    };

    $.fn.ucf.defaults = {
        title:                'Unicode Character Finder',
        search_delay:         800,
        data_file_no_unihan:  'char-data-nounihan.txt',
        scroll_trigger_zone:  20,
        combining_base_char:  '\u25cc',
        font_list:            [
            'Aegean', 'Aegyptus', 'Agency FB', 'Agency FB Bold', 'Algerian',
            'Andale Mono', 'Arial', 'Arial Black', 'Arial Narrow',
            'Arial Narrow Bold', 'Arial Narrow Bold Italic',
            'Arial Narrow Italic', 'Arial Rounded MT Bold', 'Arial Unicode MS',
            'Avant Garde', 'AvantGarde Bk BT', 'AvantGarde Md BT',
            'BankGothic Md BT', 'Baskerville', 'Baskerville Old Face',
            'Bell MT', 'Bell MT Bold', 'Bell MT Italic', 'Berlin Sans FB',
            'Berlin Sans FB Bold', 'Berlin Sans FB Demi Bold',
            'Bernard MT Condensed', 'Big Caslon', 'Bitstream Charter',
            'Bitstream Vera Sans', 'Bitstream Vera Sans Mono',
            'Bitstream Vera Serif', 'Blackadder ITC', 'Bodoni MT',
            'Bodoni MT Black', 'Bodoni MT Black Italic', 'Bodoni MT Bold',
            'Bodoni MT Bold Italic', 'Bodoni MT Condensed',
            'Bodoni MT Condensed Bold', 'Bodoni MT Condensed Bold Italic',
            'Bodoni MT Condensed Italic', 'Bodoni MT Italic',
            'Bodoni MT Poster Compressed', 'Book Antiqua', 'Book Antiqua Bold',
            'Book Antiqua Bold Italic', 'Book Antiqua Italic',
            'Bookman Old Style', 'Bookman Old Style Bold',
            'Bookman Old Style Bold Italic', 'Bookman Old Style Italic',
            'Bradley Hand ITC', 'Britannic Bold', 'Broadway',
            'Brush Script MT', 'Brush Script MT Italic', 'Calibri',
            'Calibri Bold', 'Calibri Bold Italic', 'Calibri Italic',
            'Californian FB', 'Californian FB Bold', 'Californian FB Italic',
            'Calisto MT', 'Calisto MT Bold', 'Calisto MT Bold Italic',
            'Calisto MT Italic', 'Cambria', 'Cambria Bold',
            'Cambria Bold Italic', 'Cambria Italic', 'Camisado', 'Candara',
            'Candara Bold', 'Candara Bold Italic', 'Candara Italic',
            'Cantarell', 'Castellar', 'Centaur', 'Century', 'Century Gothic',
            'Century Gothic Bold', 'Century Gothic Bold Italic',
            'Century Gothic Italic', 'Century Schoolbook',
            'Century Schoolbook Bold', 'Century Schoolbook Bold Italic',
            'Century Schoolbook Italic', 'Century Schoolbook L', 'Charcoal',
            'Chiller', 'ChunkFive', 'Colonna MT', 'Comic Sans MS', 'Consolas',
            'Consolas Bold', 'Consolas Bold Italic', 'Consolas Italic',
            'Constantia', 'Constantia Bold', 'Constantia Bold Italic',
            'Constantia Italic', 'Cooper Black', 'Cooper Hewitt',
            'Cooper Lt BT', 'Copperplate', 'Copperplate Gothic Bold',
            'Copperplate Gothic Light', 'Corbel', 'Corbel Bold',
            'Corbel Bold Italic', 'Corbel Italic', 'Courier',
            'Courier 10 Pitch', 'Courier New', 'Curlz MT', 'DejaVu Sans',
            'DejaVu Sans Mono', 'DejaVu Serif', 'Didot', 'Droid Sans',
            'Droid Serif', 'Edwardian Script ITC', 'Elephant',
            'Elephant Italic', 'EmojiOne Color', 'Engravers MT', 'Eras Bold ITC',
            'Eras Demi ITC', 'Eras Light ITC', 'Eras Medium ITC', 'Fantasy',
            'Felix Titling', 'Fertigo', 'Fontin', 'Footlight MT Light',
            'Forte', 'Franklin Gothic Book', 'Franklin Gothic Book Italic',
            'Franklin Gothic Demi', 'Franklin Gothic Demi Cond',
            'Franklin Gothic Demi Italic', 'Franklin Gothic Heavy',
            'Franklin Gothic Heavy Italic', 'Franklin Gothic Medium',
            'Franklin Gothic Medium Cond', 'FreeMono', 'FreeSans', 'FreeSerif',
            'Freestyle Script', 'French Script MT', 'Futura', 'Gabriola',
            'Gadget', 'Garamond', 'Garamond Bold', 'Garamond Italic', 'Garuda',
            'Geneva', 'Georgia', 'Gigi', 'Gill Sans', 'Gill Sans MT',
            'Gill Sans MT Bold', 'Gill Sans MT Bold Italic',
            'Gill Sans MT Condensed', 'Gill Sans MT Ext Condensed Bold',
            'Gill Sans MT Italic', 'Gill Sans Ultra Bold',
            'Gill Sans Ultra Bold Condensed', 'Gloucester MT Extra Condensed',
            'Goudy Old Style', 'Goudy Old Style Bold',
            'Goudy Old Style Italic', 'Goudy Stout', 'Haettenschweiler',
            'Harlow Solid Italic', 'Harrington', 'Helvetica',
            'High Tower Text', 'High Tower Text Italic', 'Hoefler Text',
            'Impact', 'Imprint MT Shadow', 'Inconsolata', 'Informal Roman',
            'Jokerman', 'Juice ITC', 'Komika Text', 'Kristen ITC',
            'Kunstler Script', 'Lato', 'League Gothic', 'Liberation Mono',
            'Liberation Sans', 'Liberation Sans Narrow', 'Liberation Serif',
            'Lucida Bright', 'Lucida Bright Demibold',
            'Lucida Bright Demibold Italic', 'Lucida Bright Italic',
            'Lucida Bright Regular', 'Lucida Calligraphy Italic',
            'Lucida Console', 'Lucida Fax Demibold',
            'Lucida Fax Demibold Italic', 'Lucida Fax Italic',
            'Lucida Fax Regular', 'Lucida Grande', 'Lucida Handwriting Italic',
            'Lucida Sans Regular', 'Lucida Sans Typewriter',
            'Lucida Sans Typewriter Bold',
            'Lucida Sans Typewriter Bold Oblique',
            'Lucida Sans Typewriter Oblique', 'Lucida Sans Typewriter Regular',
            'Lucida Sans Unicode', 'Magneto Bold', 'Maiandra GD',
            'Matura MT Script Capitals', 'Meiryo', 'Meiryo Bold', 'Melbourne',
            'MgOpen Canonica', 'MgOpen Cosmetica', 'MgOpen Modata',
            'MgOpen Moderna', 'Mistral', 'Modern No. 20', 'Monaco',
            'Monotype Corsiva', 'MT Extra', 'New York', 'Niagara Engraved',
            'Niagara Solid', 'Nimbus Mono L', 'Nimbus Roman No9 L',
            'Nimbus Sans L', 'Norasi', 'OCR A Extended', 'Old English Text MT',
            'Onyx', 'Open Sans', 'Optima', 'Palace Script MT', 'Palatino',
            'Palatino Linotype', 'Papyrus', 'Paramount', 'Parchment',
            'Perpetua', 'Perpetua Bold', 'Perpetua Bold Italic',
            'Perpetua Italic', 'Perpetua Titling MT Bold',
            'Perpetua Titling MT Light', 'Playbill', 'Pointy', 'Poor Richard',
            'Pristina', 'Rage Italic', 'Ravie', 'Rockwell', 'Rockwell Bold',
            'Rockwell Bold Italic', 'Rockwell Condensed',
            'Rockwell Condensed Bold', 'Rockwell Extra Bold',
            'Rockwell Italic', 'Script MT Bold', 'Segoe UI', 'Segoe UI Bold',
            'Segoe UI Bold Italic', 'Segoe UI Italic', 'Showcard Gothic',
            'Snap ITC', 'Source Code Pro', 'Souvenir Lt BT', 'Stencil',
            'Tahoma', 'Tempus Sans ITC', 'Times', 'Times New Roman',
            'Times New Yorker', 'Trebuchet MS', 'Tw Cen MT Bold',
            'Tw Cen MT Bold Italic', 'Tw Cen MT Condensed Bold',
            'Tw Cen MT Condensed Extra Bold', 'Tw Cen MT Condensed Medium',
            'Tw Cen MT Medium', 'Tw Cen MT Medium Italic', 'Ubuntu',
            'Ubuntu Condensed', 'Ubuntu Mono', 'URW Bookman L',
            'URW Chancery L', 'URW Gothic L', 'URW Palladio L', 'Utopia',
            'Verdana', 'Viner Hand ITC', 'Vivaldi Italic', 'Vladimir Script'
        ]
    };

})(jQuery);

